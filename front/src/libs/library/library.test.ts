import { describe, expect, it } from 'vitest'

import type { Model } from '../../types/library.ts'
import { baseModelName, findDuplicates } from './duplicates.ts'
import { filterModels, validateLibrarySearch } from './filters.ts'
import { suggestTags } from './tags.ts'

const model = (path: string, over: Partial<Model> = {}): Model => ({
  path,
  name: path.split('/').pop() ?? path,
  dir: '/lib',
  source_id: 1,
  ext: path.split('.').pop() ?? '',
  size: 100,
  mtime: 1,
  hash: path,
  archive: null,
  tags: [],
  notes: '',
  favorite: false,
  collectionIds: [],
  copies: 1,
  sentAt: null,
  dims: null,
  creator: '',
  sourceUrl: '',
  about: null,
  ...over,
})

describe('filterModels', () => {
  const models = [
    model('/lib/Dragon/tête_v2.stl', { tags: ['deco'], mtime: 3 }),
    model('/lib/benchy.3mf', {
      favorite: true,
      collectionIds: ['c1'],
      mtime: 2,
    }),
    model('/lib/pack.zip::vase.stl', {
      name: 'vase.stl',
      archive: '/lib/pack.zip',
      size: 900,
    }),
  ]

  it('cherche chaque mot dans le chemin et les tags, sans accents ni casse', () => {
    expect(
      filterModels(models, { q: 'dragon tete' }).map((m) => m.name),
    ).toEqual(['tête_v2.stl'])
    expect(filterModels(models, { q: 'DECO' })).toHaveLength(1)
  })

  it('combine vues, format, collection et tri', () => {
    expect(
      filterModels(models, { view: 'favorites' }).map((m) => m.name),
    ).toEqual(['benchy.3mf'])
    expect(filterModels(models, { view: 'unsorted' })).toHaveLength(2)
    expect(
      filterModels(models, { view: 'archives' }).map((m) => m.name),
    ).toEqual(['vase.stl'])
    expect(
      filterModels(models, { fmt: 'stl', sort: 'size' }).map((m) => m.name),
    ).toEqual(['vase.stl', 'tête_v2.stl'])
    expect(filterModels(models, { collection: 'c1' })).toHaveLength(1)
    expect(filterModels(models, { sort: 'recent' })[0].name).toBe('tête_v2.stl')
  })

  it('filtre ce qui tient sur une imprimante et liste les envois au slicer, le plus récent d’abord', () => {
    const printers = [{ id: 'mini', name: 'A1 mini', x: 180, y: 180, z: 180 }]
    const sized = [
      model('/lib/petit.stl', {
        dims: { x: 50, y: 50, z: 50, triangles: null },
        sentAt: 10,
      }),
      model('/lib/grand.stl', {
        dims: { x: 250, y: 50, z: 50, triangles: null },
        sentAt: 20,
      }),
      model('/lib/inconnu.glb'),
    ]
    expect(
      filterModels(sized, { printer: 'mini' }, printers).map((m) => m.name),
    ).toEqual(['petit.stl'])
    expect(filterModels(sized, { view: 'sent' }).map((m) => m.name)).toEqual([
      'grand.stl',
      'petit.stl',
    ])
  })

  it('trouve un modèle par son créateur ou le titre lu dans le fichier', () => {
    const withAuthor = [
      model('/lib/lampe.3mf', {
        creator: 'Atelier Lumière',
        about: {
          title: 'Lampe lithophane',
          designer: null,
          description: null,
          license: null,
          origin: null,
        },
      }),
      model('/lib/vase.stl'),
    ]
    expect(
      filterModels(withAuthor, { q: 'atelier lumiere' }).map((m) => m.name),
    ).toEqual(['lampe.3mf'])
    expect(filterModels(withAuthor, { q: 'lithophane' })).toHaveLength(1)
  })

  it('ignore les paramètres d’URL invalides', () => {
    expect(
      validateLibrarySearch({ sort: 'pire', view: 'x', source: 'abc', q: '' }),
    ).toEqual({
      q: undefined,
      fmt: undefined,
      sort: undefined,
      view: undefined,
      collection: undefined,
      tag: undefined,
      printer: undefined,
      source: undefined,
    })
  })
})

describe('findDuplicates', () => {
  it('normalise les noms de copies', () => {
    expect(baseModelName('dragon (1).stl')).toBe('dragon')
    expect(baseModelName('Dragon_final_FINAL.STL')).toBe('dragon')
    expect(baseModelName('benchy kopie 2.3mf')).toBe('benchy')
  })

  it('regroupe les copies exactes et suggère de garder celle hors archive au nom le plus court', () => {
    const groups = findDuplicates([
      model('/a/dragon (1).stl', { hash: 'h1' }),
      model('/a/dragon.stl', { hash: 'h1' }),
      model('/a/pack.zip::dragon.stl', {
        name: 'dragon.stl',
        hash: 'h1',
        archive: '/a/pack.zip',
      }),
      model('/a/dragon_v2.stl', { hash: 'h2' }),
      model('/a/benchy.3mf', { hash: 'h3' }),
    ])
    expect(groups.map((g) => [g.kind, g.keep.path, g.others.length])).toEqual([
      ['exact', '/a/dragon.stl', 2],
      ['probable', '/a/dragon.stl', 1],
    ])
    expect(groups[0].reclaimable).toBe(200)
  })

  it('reconnaît le même modèle dans deux formats, même pivoté', () => {
    const dims = (x: number, y: number, z: number) => ({
      x,
      y,
      z,
      triangles: 1200,
    })
    const groups = findDuplicates([
      model('/a/support.stl', { hash: 'h1', dims: dims(40, 20.02, 10) }),
      model('/a/Support plateau.3mf', {
        hash: 'h2',
        ext: '3mf',
        dims: dims(20, 10, 40),
      }),
      model('/a/autre.stl', { hash: 'h3', dims: dims(40, 20, 11) }),
    ])
    expect(
      groups.map((g) => [g.kind, g.keep.path, g.others.map((m) => m.path)]),
    ).toEqual([['geometry', '/a/support.stl', ['/a/Support plateau.3mf']]])
  })
})

describe('suggestTags', () => {
  it('propose les mots des dossiers et du nom, tags connus en premier', () => {
    expect(
      suggestTags(
        {
          path: '/lib/Impression 3D/Warhammer/Dragon rouge v2/STL/dragon_tete-01.stl',
          tags: ['dragon'],
        },
        '/lib/Impression 3D',
        ['rouge'],
      ),
    ).toEqual(['rouge', 'warhammer', 'tete'])
  })
})
