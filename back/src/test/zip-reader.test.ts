import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { embeddedThumbnail } from '../main/infra/fs/model-files.ts'
import {
  fileSource,
  listEntries,
  readEntry,
  withZip,
} from '../main/infra/fs/zip-reader.ts'

const fixture = (name: string) =>
  path.join(import.meta.dirname, 'fixtures', name)

describe('zip-reader', () => {
  it('liste et lit les entrées d’un 3MF façon Bambu (composants dans un fichier séparé)', async () => {
    const names = await withZip(
      await fileSource(fixture('bambu_projet.3mf')),
      async (entries, source) => {
        const model = entries.find(
          (e) => e.name === '3D/Objects/object_1.model',
        )
        expect(model).toBeDefined()
        expect(
          (
            await readEntry(source, model as NonNullable<typeof model>)
          ).toString(),
        ).toContain('<vertex')
        return entries.map((e) => e.name).sort()
      },
    )
    expect(names).toEqual([
      '3D/3dmodel.model',
      '3D/Objects/object_1.model',
      'Metadata/plate_1.png',
    ])
  })

  it('extrait la miniature enregistrée par le slicer, et rien quand il n’y en a pas', async () => {
    const png = await embeddedThumbnail(
      await fs.readFile(fixture('bambu_projet.3mf')),
    )
    expect(png?.subarray(1, 4).toString()).toBe('PNG')
    expect(
      await embeddedThumbnail(await fs.readFile(fixture('simple.3mf'))),
    ).toBeUndefined()
  })

  it('rend une liste vide pour un fichier qui n’est pas un ZIP', async () => {
    const source = await fileSource(
      fixture('simple.3mf').replace('simple.3mf', '../zip-reader.test.ts'),
    )
    expect(await listEntries(source)).toEqual([])
    await source.close()
  })
})
