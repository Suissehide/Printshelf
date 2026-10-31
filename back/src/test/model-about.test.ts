import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  aboutFrom3mf,
  detectSource,
  mergeAbout,
} from '../main/infra/fs/model-about.ts'

const fixture = (name: string) =>
  fs.readFile(path.join(import.meta.dirname, 'fixtures', name))

describe('à propos d’un modèle', () => {
  it('lit titre, créateur, licence, lien d’origine et description (HTML → texte) d’un 3MF MakerWorld', async () => {
    expect(await aboutFrom3mf(await fixture('makerworld.3mf'))).toEqual({
      title: 'Lampe lithophane & support',
      designer: 'Atelier Lumière',
      description: 'Une lampe sans supports.\n• PLA blanc\n• 0,2 mm',
      license: 'BY-NC-SA',
      origin: 'https://makerworld.com/fr/models/123456',
    })
  })

  it('rend une fiche vide pour un 3MF sans métadonnées', async () => {
    expect(await aboutFrom3mf(await fixture('simple.3mf'))).toMatchObject({
      title: null,
      designer: null,
      origin: null,
    })
  })

  it('repère la page du modèle et le créateur dans les readme d’un pack', () => {
    const thingiverse =
      'Dragon articulé by MakerJo on Thingiverse: https://www.thingiverse.com/thing:4567890\n\nLicence : CC BY'
    expect(detectSource([thingiverse])).toEqual({
      origin: 'https://www.thingiverse.com/thing:4567890',
      designer: 'MakerJo',
    })
    expect(
      detectSource([
        'Voir https://www.printables.com/model/123456-vase-spirale pour les réglages',
      ]),
    ).toEqual({
      origin: 'https://www.printables.com/model/123456-vase-spirale',
      designer: null,
    })
    expect(detectSource(['Lien perso : https://exemple.fr/truc'])).toEqual({
      origin: null,
      designer: null,
    })
  })

  it('donne la priorité aux infos du 3MF sur celles du pack', () => {
    const fromModel = {
      title: 'T',
      designer: null,
      description: null,
      license: null,
      origin: 'https://makerworld.com/models/1',
    }
    expect(
      mergeAbout(fromModel, {
        origin: 'https://www.thingiverse.com/thing:2',
        designer: 'Jo',
      }),
    ).toMatchObject({
      designer: 'Jo',
      origin: 'https://makerworld.com/models/1',
    })
  })
})
