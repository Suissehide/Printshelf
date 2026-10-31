import { describe, expect, it } from 'vitest'

import { fitsOn, groupBySlicer, resolveSlicer } from './slicer.ts'

const slicers = [
  { id: 'bambu-studio', name: 'Bambu Studio' },
  { id: 'lychee-slicer', name: 'Lychee Slicer' },
]
const prefs = {
  defaultSlicerId: 'bambu-studio',
  tagRules: [
    { tag: 'résine', slicerId: 'lychee-slicer' },
    { tag: 'cura', slicerId: 'ultimaker-cura' }, // non installé ici
  ],
}

describe('resolveSlicer', () => {
  it('suit les règles par tag, puis le slicer par défaut, en ignorant les slicers absents', () => {
    expect(
      resolveSlicer({ tags: ['figurine', 'résine'] }, prefs, slicers),
    ).toBe('lychee-slicer')
    expect(resolveSlicer({ tags: ['cura'] }, prefs, slicers)).toBe(
      'bambu-studio',
    )
    expect(
      resolveSlicer(
        { tags: [] },
        { defaultSlicerId: 'absent', tagRules: [] },
        slicers,
      ),
    ).toBe('bambu-studio')
    expect(resolveSlicer({ tags: [] }, undefined, [])).toBeUndefined()
  })

  it('regroupe une sélection par slicer cible', () => {
    const groups = groupBySlicer(
      [{ tags: ['résine'] }, { tags: [] }, { tags: [] }],
      prefs,
      slicers,
    )
    expect([...groups].map(([id, models]) => [id, models.length])).toEqual([
      ['lychee-slicer', 1],
      ['bambu-studio', 2],
    ])
  })
})

describe('fitsOn', () => {
  const a1mini = { id: 'm', name: 'A1 mini', x: 180, y: 180, z: 180 }
  const mk4 = { id: 'p', name: 'MK4', x: 250, y: 210, z: 220 }

  it('accepte un quart de tour sur le plateau, jamais sur la hauteur', () => {
    expect(fitsOn({ x: 180, y: 180, z: 180 }, a1mini)).toBe(true)
    expect(fitsOn({ x: 181, y: 10, z: 10 }, a1mini)).toBe(false)
    expect(fitsOn({ x: 200, y: 240, z: 50 }, mk4)).toBe(true) // tourné de 90°
    expect(fitsOn({ x: 100, y: 100, z: 221 }, mk4)).toBe(false)
  })
})
