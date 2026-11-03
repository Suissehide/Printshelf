import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { buildContainer } from '../main/application/container.ts'
import { testConfig } from './test-config.ts'

const fixture = (name: string) =>
  path.join(import.meta.dirname, 'fixtures', name)
const STL =
  'solid t\nfacet normal 0 0 0\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid t\n'

const waitFor = async (check: () => boolean, timeout = 8000) => {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > timeout) {
      throw new Error('délai dépassé')
    }
    await new Promise((r) => setTimeout(r, 50))
  }
}

// Un pack typique : modèles dans STL/, rendus dans Images/, notice à la racine, et un fichier
// HORS de la source qui ne doit jamais remonter.
const makeLibrary = async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'printshelf-lib-'))
  const source = path.join(root, 'source')
  await fs.mkdir(path.join(source, 'pack', 'STL'), { recursive: true })
  await fs.mkdir(path.join(source, 'pack', 'Images'), { recursive: true })
  await fs.writeFile(path.join(source, 'pack', 'STL', 'dragon.stl'), STL)
  await fs.writeFile(path.join(source, 'pack', 'Images', 'rendu.jpg'), 'jpg')
  await fs.writeFile(path.join(source, 'pack', 'notice.pdf'), 'pdf')
  await fs.writeFile(path.join(source, 'pack', 'readme.md'), '# Dragon')
  await fs.writeFile(path.join(source, 'pack', 'Images', 'icone.svg'), '<svg/>')
  await fs.writeFile(path.join(root, 'secret.txt'), 'hors source')
  await fs.copyFile(
    fixture('bambu_plateaux.3mf'),
    path.join(source, 'projet.3mf'),
  )
  execFileSync('zip', ['-qr', path.join(source, 'pack.zip'), 'pack'], {
    cwd: source,
  })
  const app = buildContainer({
    ...testConfig,
    DATA_DIR: path.join(root, 'data'),
  })
  return { root, source, app }
}

let current: Awaited<ReturnType<typeof makeLibrary>> | undefined
afterEach(() => current?.app.libraryDomain.stopWatching())

const scanned = async (lib: Awaited<ReturnType<typeof makeLibrary>>) => {
  await lib.app.libraryDomain.addSource(lib.source)
  await waitFor(
    () =>
      !lib.app.libraryDomain.scanStatus.running &&
      lib.app.libraryDomain.listFiles().length > 0,
  )
}

describe('bibliothèque', () => {
  it('liste les fichiers d’accompagnement du pack, sur le disque comme dans l’archive, sans sortir de la source', async () => {
    current = await makeLibrary()
    await scanned(current)
    const { libraryDomain } = current.app
    const onDisk = path.join(current.source, 'pack', 'STL', 'dragon.stl')
    const expected = [
      { name: 'Images/rendu.jpg', kind: 'image', size: 3 },
      { name: 'notice.pdf', kind: 'pdf', size: 3 },
      { name: 'readme.md', kind: 'text', size: 8 },
    ]
    expect(await libraryDomain.listCompanions(onDisk)).toEqual(expected)
    expect(
      await libraryDomain.listCompanions(
        `${current.source}/pack.zip::pack/STL/dragon.stl`,
      ),
    ).toEqual(expected)

    const readme = await libraryDomain.readCompanion(onDisk, 'readme.md')
    expect(readme).toEqual({
      data: Buffer.from('# Dragon'),
      contentType: 'text/plain; charset=utf-8',
    })
    await expect(
      libraryDomain.readCompanion(onDisk, '../../secret.txt'),
    ).rejects.toThrow()
    await expect(
      libraryDomain.readCompanion(onDisk, 'Images/icone.svg'),
    ).rejects.toThrow()

    // Modèle à la racine de la source : la recherche ne remonte pas au-dessus, et ne descend
    // que d'un niveau (pack/), pas jusqu'à pack/Images/.
    expect(
      await libraryDomain.listCompanions(
        path.join(current.source, 'projet.3mf'),
      ),
    ).toEqual(expected.slice(1).map((c) => ({ ...c, name: `pack/${c.name}` })))
  })

  it('parcourt une archive 7z comme un ZIP (via bsdtar)', async () => {
    current = await makeLibrary()
    execFileSync('tar', ['--format', '7zip', '-cf', 'pack.7z', 'pack'], {
      cwd: current.source,
    })
    await scanned(current)
    const files = current.app.libraryDomain.listFiles()
    const inside = files.find(
      (f) => f.path === `${current?.source}/pack.7z::pack/STL/dragon.stl`,
    )
    const onDisk = files.find(
      (f) => f.path === `${current?.source}/pack/STL/dragon.stl`,
    )
    expect(inside?.hash).toBe(onDisk?.hash)
    expect(inside?.archive).toBe(`${current.source}/pack.7z`)
    const content = await current.app.libraryDomain.readContent(
      inside?.path ?? '',
    )
    expect(content.toString()).toBe(STL)
    const companions = await current.app.libraryDomain.listCompanions(
      inside?.path ?? '',
    )
    expect(companions.map((c) => c.name)).toContain('notice.pdf')
  })

  it('range des fichiers dans un nouveau dossier, sans rien écraser ni toucher aux archives', async () => {
    current = await makeLibrary()
    const { source } = current
    await fs.writeFile(path.join(source, 'repose_casque_base.stl'), STL)
    await fs.writeFile(path.join(source, 'repose_casque_bras.stl'), `${STL} `)
    // Un fichier du même nom attend déjà dans le dossier cible : il ne doit pas être écrasé.
    await fs.mkdir(path.join(source, 'Repose casque'))
    await fs.writeFile(
      path.join(source, 'Repose casque', 'repose_casque_bras.stl'),
      'déjà là',
    )
    await scanned(current)
    const library = current.app.libraryDomain
    const hashBefore = library.getFile(
      path.join(source, 'repose_casque_base.stl'),
    ).hash

    const result = await library.groupIntoFolder(
      [
        path.join(source, 'repose_casque_base.stl'),
        path.join(source, 'repose_casque_bras.stl'),
      ],
      'Repose casque',
    )
    expect(result.folder).toBe(path.join(source, 'Repose casque'))
    expect(result.moved.map((m) => path.basename(m.to)).sort()).toEqual([
      'repose_casque_base.stl',
      'repose_casque_bras (2).stl',
    ])
    expect(
      await fs.readFile(
        path.join(source, 'Repose casque', 'repose_casque_bras.stl'),
        'utf8',
      ),
    ).toBe('déjà là')
    await expect(
      fs.stat(path.join(source, 'repose_casque_base.stl')),
    ).rejects.toThrow()

    // L'index suit tout de suite : même contenu (même hash) au nouvel emplacement.
    expect(
      library.getFile(
        path.join(source, 'Repose casque', 'repose_casque_base.stl'),
      ).hash,
    ).toBe(hashBefore)

    await expect(
      library.groupIntoFolder(
        [`${source}/pack.zip::pack/STL/dragon.stl`],
        'Dragon',
      ),
    ).rejects.toThrow(/archive/)
  })

  it('purge une fois les miniatures identiques pour des contenus différents', async () => {
    current = await makeLibrary()
    await fs.writeFile(path.join(current.source, 'a.stl'), STL)
    await fs.writeFile(path.join(current.source, 'b.stl'), `${STL}\n`)
    await fs.writeFile(path.join(current.source, 'c.stl'), `${STL}\n\n`)
    await scanned(current)
    const library = current.app.libraryDomain
    const hashOf = (name: string) =>
      library.getFile(path.join(current?.source ?? '', name)).hash
    const png = (text: string) => Buffer.from(`\x89PNG ${text}`)
    await library.putThumbnail(hashOf('a.stl'), png('a'))
    await library.putThumbnail(hashOf('b.stl'), png('a')) // l'image de a, enregistrée pour b
    await library.putThumbnail(hashOf('c.stl'), png('c'))

    expect(await library.purgeDuplicateThumbnailsOnce()).toBe(2)
    expect(await library.getThumbnail(hashOf('a.stl'))).toBeNull()
    expect(await library.getThumbnail(hashOf('b.stl'))).toBeNull()
    expect((await library.getThumbnail(hashOf('c.stl')))?.toString()).toContain(
      'c',
    )

    await library.putThumbnail(hashOf('a.stl'), png('c'))
    expect(await library.purgeDuplicateThumbnailsOnce()).toBe(0) // une seule fois
    expect(await library.resetThumbnails()).toBe(2)
    expect(await library.getThumbnail(hashOf('c.stl'))).toBeNull()
  })

  it('lit les infos d’impression et la miniature d’un plateau', async () => {
    current = await makeLibrary()
    await scanned(current)
    const projet = path.join(current.source, 'projet.3mf')
    expect(
      (await current.app.libraryDomain.getPrintInfo(projet)).plates,
    ).toHaveLength(2)
    const png = await current.app.libraryDomain.readPlateThumbnail(projet, 2)
    expect(png.subarray(1, 4).toString()).toBe('PNG')
    await expect(
      current.app.libraryDomain.readPlateThumbnail(projet, 3),
    ).rejects.toThrow()
  })

  it('détecte un modèle ajouté dans une source surveillée', async () => {
    current = await makeLibrary()
    await scanned(current)
    const { libraryDomain } = current.app
    const before = libraryDomain.listFiles().length
    libraryDomain.watchSources()
    await new Promise((r) => setTimeout(r, 200))
    await fs.writeFile(path.join(current.source, 'nouveau.stl'), `${STL}\n`)
    await waitFor(() => libraryDomain.listFiles().length === before + 1)
    expect(
      libraryDomain.listFiles().some((f) => f.name === 'nouveau.stl'),
    ).toBe(true)
  }, 15_000)
})
