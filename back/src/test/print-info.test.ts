import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { readPrintInfo } from '../main/infra/fs/print-info.ts'
import { fileSource } from '../main/infra/fs/zip-reader.ts'

const read = async (name: string) => {
  const source = await fileSource(
    path.join(import.meta.dirname, 'fixtures', name),
  )
  try {
    return await readPrintInfo(source)
  } finally {
    await source.close()
  }
}

describe('readPrintInfo', () => {
  it('lit plateaux, objets, filaments et tranchage d’un projet Bambu Studio', async () => {
    const info = await read('bambu_plateaux.3mf')
    expect(info).toMatchObject({
      slicer: 'bambu',
      printer: 'Bambu Lab A1',
      layerHeight: 0.2,
    })
    expect(info.filaments).toEqual([
      { color: '#ffffff', type: 'PLA' },
      { color: '#ff6a13', type: 'PETG' },
    ])
    expect(info.plates).toEqual([
      {
        index: 1,
        name: 'Cubes',
        objectIds: ['2'],
        seconds: 3725,
        grams: 12.48,
        filaments: [{ color: '#ffffff', type: 'PLA', grams: 12.48 }],
      },
      {
        index: 2,
        name: '',
        objectIds: ['4'],
        seconds: null,
        grams: null,
        filaments: [],
      },
    ])
    expect(info.objects).toEqual([
      {
        id: '2',
        name: 'Cube & co',
        extruder: 1,
        parts: [{ id: '1', extruder: 0 }],
      },
      {
        id: '4',
        name: 'Tour',
        extruder: 1,
        parts: [
          { id: '3', extruder: 0 },
          { id: '5', extruder: 2 },
        ],
      },
    ])
  })

  it('rend une fiche vide pour un 3MF sans réglages de slicer', async () => {
    expect(await read('simple.3mf')).toMatchObject({
      slicer: null,
      plates: [],
      filaments: [],
    })
  })
})
