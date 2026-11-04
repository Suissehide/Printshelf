import type { Model, Source } from '../../types/library.ts'

// Navigation par dossiers, comme dans le Finder : le contenu d'un dossier = ses sous-dossiers
// (avec quelques miniatures en aperçu) puis ses fichiers. Une archive (ZIP, RAR, 7z) est un dossier
// comme un autre. Chemins Mac et Windows comparés avec des « / ».

export type FolderEntry = {
  path: string
  name: string
  count: number
  samples: Model[]
  archive: boolean
}

export type FolderListing = {
  // '' : la racine, qui liste les sources quand il y en a plusieurs.
  current: string
  crumbs: { path: string; name: string }[]
  folders: FolderEntry[]
  files: Model[]
}

const norm = (p: string) => p.replaceAll('\\', '/').replace(/\/+$/, '')
const lastSegment = (p: string) => norm(p).split('/').pop() || p

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'fr', { numeric: true, sensitivity: 'base' })

const entry = (path: string, name: string, archive: boolean): FolderEntry => ({
  path,
  name,
  count: 0,
  samples: [],
  archive,
})

const add = (folder: FolderEntry, model: Model) => {
  folder.count++
  if (folder.samples.length < 4) {
    folder.samples.push(model)
  }
}

// Dossier affiché : celui de l'URL, sinon la source choisie, sinon la seule source, sinon la racine.
export const currentFolder = (
  sources: Pick<Source, 'id' | 'path'>[],
  dir?: string,
  sourceId?: number,
): string => {
  if (dir) {
    return norm(dir)
  }
  const source =
    sources.find((s) => s.id === sourceId) ??
    (sources.length === 1 ? sources[0] : undefined)
  return source ? norm(source.path) : ''
}

// Racine : une carte par source.
const sourceFolders = (
  models: Model[],
  sources: Pick<Source, 'id' | 'path'>[],
) => {
  const bySource = new Map(
    sources.map((s) => [s.id, entry(norm(s.path), lastSegment(s.path), false)]),
  )
  for (const m of models) {
    const folder = bySource.get(m.source_id)
    if (folder) {
      add(folder, m)
    }
  }
  return [...bySource.values()].filter((f) => f.count > 0)
}

// Fil d'Ariane : de la source jusqu'au dossier courant.
const crumbsTo = (current: string, sources: Pick<Source, 'path'>[]) => {
  const source = sources
    .map((s) => norm(s.path))
    .filter((p) => current === p || current.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length)[0]
  if (!source) {
    return []
  }
  const crumbs = [{ path: source, name: lastSegment(source) }]
  let path = source
  for (const segment of current
    .slice(source.length)
    .split('/')
    .filter(Boolean)) {
    path = `${path}/${segment}`
    crumbs.push({ path, name: segment })
  }
  return crumbs
}

export const browseFolder = (
  models: Model[],
  sources: Pick<Source, 'id' | 'path'>[],
  current: string,
): FolderListing => {
  if (current === '') {
    return {
      current,
      crumbs: [],
      folders: sourceFolders(models, sources),
      files: [],
    }
  }
  const archives = new Set(
    models.flatMap((m) => (m.archive ? [norm(m.archive)] : [])),
  )
  const folders = new Map<string, FolderEntry>()
  const files: Model[] = []
  for (const m of models) {
    const dir = norm(m.dir)
    if (dir === current) {
      files.push(m)
    } else if (dir.startsWith(`${current}/`)) {
      const name = dir.slice(current.length + 1).split('/')[0]
      const path = `${current}/${name}`
      const folder = folders.get(path) ?? entry(path, name, archives.has(path))
      folders.set(path, folder)
      add(folder, m)
    }
  }
  return {
    current,
    crumbs: crumbsTo(current, sources),
    folders: [...folders.values()].sort(byName),
    files,
  }
}
