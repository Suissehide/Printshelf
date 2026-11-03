import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildContainer } from '../main/application/container.ts'
import { hashFile, sha1 } from '../main/infra/fs/model-files.ts'
import { safeName } from '../main/infra/fs/paths.ts'
import { testConfig } from './test-config.ts'

const STL =
  'solid t\nfacet normal 0 0 0\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid t\n'
const PNG = Buffer.from('89504e470d0a1a0a', 'hex')
const PAGE = 'https://www.printables.com/model/123-dragon'

const setup = async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'printshelf-import-'))
  const library = path.join(root, 'Impression 3D')
  const downloads = path.join(root, 'Téléchargements')
  await fs.mkdir(library)
  await fs.mkdir(downloads)
  const requested: string[] = []
  // Couvertures : pas de réseau dans les tests, une image locale répond à leur place.
  const fetchImpl = ((url: URL) => {
    requested.push(String(url))
    return Promise.resolve(
      new Response(PNG, { headers: { 'content-type': 'image/png' } }),
    )
  }) as typeof fetch
  const app = buildContainer(
    { ...testConfig, DATA_DIR: path.join(root, 'data') },
    { fetchImpl },
  )
  await app.libraryDomain.addSource(library)
  return { root, library, downloads, app, requested }
}

describe('import depuis le navigateur', () => {
  it('copie le téléchargement avec couverture et lisez-moi, et renseigne créateur et source', async () => {
    const { library, downloads, app, requested } = await setup()
    const file = path.join(downloads, 'dragon.stl')
    await fs.writeFile(file, STL)

    const result = await app.importDomain.import({
      path: file,
      pageUrl: PAGE,
      title: 'Dragon articulé',
      creator: 'MakerJo',
      imageUrl: 'https://media.printables.com/dragon.png',
      description: 'Sans supports.',
    })

    const folder = path.join(
      library,
      'Importés Printshelf',
      'Dragon articulé — printables.com',
    )
    expect(result).toEqual({
      folder,
      file: path.join(folder, 'dragon.stl'),
      models: 1,
    })
    expect(await fs.readFile(file, 'utf8')).toBe(STL) // l'original reste dans Téléchargements
    expect((await fs.readdir(folder)).sort()).toEqual([
      'LISEZMOI.txt',
      'couverture.png',
      'dragon.stl',
    ])
    expect(await fs.readFile(path.join(folder, 'LISEZMOI.txt'), 'utf8')).toBe(
      `Dragon articulé\nCréateur : MakerJo\nSource : ${PAGE}\n\nSans supports.\n`,
    )
    expect(requested).toEqual(['https://media.printables.com/dragon.png'])
    expect(app.organizerDomain.listMetas()[0]).toMatchObject({
      hash: await hashFile(file),
      creator: 'MakerJo',
      sourceUrl: PAGE,
    })

    // Réimporter : pas de copie en double, et la saisie de l'utilisateur n'est pas écrasée.
    app.organizerDomain.updateMeta(await hashFile(file), {
      creator: 'Jo le Maker',
    })
    await app.importDomain.import({
      path: file,
      pageUrl: PAGE,
      title: 'Dragon articulé',
      creator: 'Autre',
    })
    expect((await fs.readdir(folder)).sort()).toEqual([
      'LISEZMOI.txt',
      'couverture.png',
      'dragon.stl',
    ])
    expect(app.organizerDomain.listMetas()[0].creator).toBe('Jo le Maker')
  })

  it('renseigne chaque modèle d’une archive, et ajoute aux sources un dossier d’import extérieur', async () => {
    const { root, downloads, app } = await setup()
    await fs.mkdir(path.join(downloads, 'pack'))
    await fs.writeFile(path.join(downloads, 'pack', 'tete.stl'), STL)
    await fs.writeFile(path.join(downloads, 'pack', 'queue.stl'), `${STL}\n`)
    execFileSync('zip', ['-qr', 'pack.zip', 'pack'], { cwd: downloads })
    const elsewhere = path.join(root, 'Mes imports')
    await app.importDomain.setFolder(elsewhere)

    const result = await app.importDomain.import({
      path: path.join(downloads, 'pack.zip'),
      pageUrl: 'https://makerworld.com/fr/models/9',
    })

    expect(result.models).toBe(2)
    expect(
      app.organizerDomain
        .listMetas()
        .map((m) => m.hash)
        .sort(),
    ).toEqual([sha1(Buffer.from(STL)), sha1(Buffer.from(`${STL}\n`))].sort())
    expect(app.libraryDomain.listSources().map((s) => s.path)).toContain(
      elsewhere,
    )
  })

  it('refuse ce qui n’est pas un modèle, un chemin relatif ou un fichier absent', async () => {
    const { downloads, app } = await setup()
    await fs.writeFile(path.join(downloads, 'facture.pdf'), 'pdf')
    await expect(
      app.importDomain.import({
        path: path.join(downloads, 'facture.pdf'),
        pageUrl: PAGE,
      }),
    ).rejects.toThrow()
    await expect(
      app.importDomain.import({ path: 'dragon.stl', pageUrl: PAGE }),
    ).rejects.toThrow()
    await expect(
      app.importDomain.import({
        path: path.join(downloads, 'absent.stl'),
        pageUrl: PAGE,
      }),
    ).rejects.toThrow()
  })

  it('fabrique des noms de dossier valides partout', () => {
    expect(safeName('Vase: "spirale" / v2?')).toBe('Vase spirale v2')
    expect(safeName('  ...  ')).toBe('Modèle')
  })
})
