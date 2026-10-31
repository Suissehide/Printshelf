import { describe, expect, it } from 'vitest'

import { siteName } from './source-panel.tsx'

describe('siteName', () => {
  it('reconnaît les sites de modèles et refuse ce qui n’est pas un lien http(s)', () => {
    expect(siteName('https://www.printables.com/model/1')).toBe('Printables')
    expect(siteName('https://makerworld.com/fr/models/2')).toBe('MakerWorld')
    expect(siteName('https://www.thingiverse.com/thing:3')).toBe('Thingiverse')
    expect(siteName('https://boutique.exemple.fr/p/4')).toBe(
      'boutique.exemple.fr',
    )
    expect(siteName('javascript:alert(1)')).toBeNull()
    expect(siteName('pas un lien')).toBeNull()
  })
})
