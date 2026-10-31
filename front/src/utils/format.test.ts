import { describe, expect, it } from 'vitest'

import { sourceRelativeDir } from './format.ts'

describe('sourceRelativeDir', () => {
  it('affiche le dossier depuis sa source, sur Mac comme sur Windows', () => {
    const sources = [
      { path: '/Users/léo/Impression 3D' },
      { path: 'D:\\Modèles\\' },
    ]
    expect(
      sourceRelativeDir('/Users/léo/Impression 3D/Jeux/Échecs', sources),
    ).toBe('Impression 3D › Jeux › Échecs')
    expect(sourceRelativeDir('/Users/léo/Impression 3D', sources)).toBe(
      'Impression 3D',
    )
    expect(sourceRelativeDir('D:\\Modèles\\Pack.zip\\STL', sources)).toBe(
      'Modèles › Pack.zip › STL',
    )
    expect(sourceRelativeDir('/ailleurs/x', sources)).toBe('/ailleurs/x')
  })
})
