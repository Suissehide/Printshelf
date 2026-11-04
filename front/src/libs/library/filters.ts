import type { Model, Printer } from '../../types/library.ts'
import { fitsOn } from './slicer.ts'

export type LibrarySort = 'name' | 'recent' | 'size'
export type LibraryView = 'favorites' | 'unsorted' | 'archives' | 'sent'

export type LibrarySearch = {
  q?: string
  fmt?: string
  sort?: LibrarySort
  view?: LibraryView
  collection?: string
  tag?: string
  source?: number
  // Identifiant d'imprimante : seulement les modèles mesurés qui tiennent sur son plateau.
  printer?: string
  // Dossier parcouru (navigation par dossiers), et « flat » pour tout voir à plat.
  dir?: string
  layout?: 'flat'
}

const SORTS: LibrarySort[] = ['name', 'recent', 'size']
const VIEWS: LibraryView[] = ['favorites', 'unsorted', 'archives', 'sent']
const text = (v: unknown) => (typeof v === 'string' && v ? v : undefined)

// Les filtres vivent dans l'URL : un lien ou un retour arrière retrouve exactement la même vue.
export const validateLibrarySearch = (
  raw: Record<string, unknown>,
): LibrarySearch => ({
  q: text(raw.q),
  fmt: text(raw.fmt),
  sort: SORTS.includes(raw.sort as LibrarySort)
    ? (raw.sort as LibrarySort)
    : undefined,
  view: VIEWS.includes(raw.view as LibraryView)
    ? (raw.view as LibraryView)
    : undefined,
  collection: text(raw.collection),
  tag: text(raw.tag),
  printer: text(raw.printer),
  dir: text(raw.dir),
  layout: raw.layout === 'flat' ? 'flat' : undefined,
  source:
    Number.isInteger(Number(raw.source)) && raw.source !== undefined
      ? Number(raw.source)
      : undefined,
})

// Les dossiers ne servent qu'à parcourir : une recherche ou un filtre montre les résultats à plat.
export const browsingFolders = (search: LibrarySearch): boolean =>
  search.layout !== 'flat' &&
  !search.q &&
  !search.collection &&
  !search.tag &&
  !search.view &&
  !search.printer

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const matchesFilters = (
  m: Model,
  search: LibrarySearch,
  printer: Printer | undefined,
): boolean =>
  (!search.fmt ||
    m.ext === search.fmt ||
    (search.fmt === 'step' && m.ext === 'stp')) &&
  (search.source === undefined || m.source_id === search.source) &&
  (!search.collection || m.collectionIds.includes(search.collection)) &&
  (!search.tag || m.tags.includes(search.tag)) &&
  (search.view !== 'favorites' || m.favorite) &&
  (search.view !== 'unsorted' || m.collectionIds.length === 0) &&
  (search.view !== 'archives' || m.archive !== null) &&
  (search.view !== 'sent' || m.sentAt !== null) &&
  (!printer || (m.dims !== null && fitsOn(m.dims, printer)))

const COMPARATORS: Record<LibrarySort, (a: Model, b: Model) => number> = {
  name: (a, b) =>
    a.name.localeCompare(b.name, 'fr', { numeric: true, sensitivity: 'base' }),
  recent: (a, b) => b.mtime - a.mtime,
  size: (a, b) => b.size - a.size,
}
const BY_SENT = (a: Model, b: Model) => (b.sentAt ?? 0) - (a.sentAt ?? 0)

export const filterModels = (
  models: Model[],
  search: LibrarySearch,
  printers: Printer[] = [],
): Model[] => {
  const printer = search.printer
    ? printers.find((p) => p.id === search.printer)
    : undefined
  // Chaque mot doit apparaître dans le nom, le dossier, les tags ou les notes : « dragon tete »
  // trouve « Dragon/tête_v2.stl ».
  const words = normalize(search.q ?? '')
    .split(/\s+/)
    .filter(Boolean)
  const matchesWords = (m: Model) => {
    const haystack = normalize(
      `${m.path} ${m.tags.join(' ')} ${m.notes} ${m.creator} ${m.about?.title ?? ''}`,
    )
    return words.every((w) => haystack.includes(w))
  }
  return models
    .filter(
      (m) =>
        matchesFilters(m, search, printer) &&
        (words.length === 0 || matchesWords(m)),
    )
    .sort(
      // « Envoyés au slicer » : le plus récent d'abord, sauf tri explicite.
      search.view === 'sent' && !search.sort
        ? BY_SENT
        : COMPARATORS[search.sort ?? 'name'],
    )
}
