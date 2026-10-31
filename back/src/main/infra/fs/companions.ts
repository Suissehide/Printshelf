import fs from 'node:fs/promises'
import path from 'node:path'

import { extensionOf } from './model-files.ts'
import type { ZipEntry } from './zip-reader.ts'

// Fichiers d'accompagnement d'un modèle : rendus, photos, notices PDF, readme. Un pack typique
// range ses images à côté des modèles ou dans un dossier frère (`STL/`, `Images/`) : on regarde
// le dossier du modèle et son parent, plus un niveau de sous-dossiers, SANS jamais sortir de la
// source (ou de l'archive). SVG exclu : servi depuis notre origine, il pourrait exécuter du script.

export type CompanionKind = 'image' | 'pdf' | 'text'
export type Companion = { name: string; kind: CompanionKind; size: number }

const KINDS: Record<string, CompanionKind> = {
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  webp: 'image',
  gif: 'image',
  pdf: 'pdf',
  txt: 'text',
  md: 'text',
  markdown: 'text',
}
export const CONTENT_TYPES: Record<CompanionKind, (ext: string) => string> = {
  image: (ext) => `image/${ext === 'jpg' ? 'jpeg' : ext}`,
  pdf: () => 'application/pdf',
  text: () => 'text/plain; charset=utf-8',
}
const MAX_COMPANIONS = 80
const MAX_DIRS = 60

export const companionKind = (name: string): CompanionKind | undefined =>
  KINDS[extensionOf(name)]

// Dossier de base de la recherche : le parent du dossier du modèle, sauf s'il sort de `root`.
export const searchBase = (dir: string, root: string) => {
  const parent = path.dirname(dir)
  const inside =
    parent === root ||
    parent.startsWith(root.endsWith(path.sep) ? root : root + path.sep)
  return dir !== root && inside ? parent : dir
}

const sortCompanions = (list: Companion[]) =>
  list
    .sort(
      (a, b) =>
        a.kind.localeCompare(b.kind) ||
        a.name.localeCompare(b.name, 'fr', { numeric: true }),
    )
    .slice(0, MAX_COMPANIONS)

export const diskCompanions = async (
  modelDir: string,
  sourceRoot: string,
): Promise<{ base: string; list: Companion[] }> => {
  const base = searchBase(modelDir, sourceRoot)
  const list: Companion[] = []
  const visit = async (
    dir: string,
    depth: number,
    budget: { dirs: number },
  ) => {
    if (budget.dirs-- <= 0) {
      return
    }
    const entries = await fs
      .readdir(dir, { withFileTypes: true })
      .catch(() => [])
    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue
      }
      const full = path.join(dir, entry.name)
      const kind = companionKind(entry.name)
      if (entry.isFile() && kind) {
        const { size } = await fs.stat(full)
        list.push({
          name: path.relative(base, full).split(path.sep).join('/'),
          kind,
          size,
        })
      } else if (entry.isDirectory() && depth > 0) {
        await visit(full, depth - 1, budget)
      }
    }
  }
  await visit(base, 1, { dirs: MAX_DIRS })
  // Le dossier du modèle peut être à deux niveaux sous la base : on le lit aussi.
  if (path.relative(base, modelDir).includes(path.sep)) {
    await visit(modelDir, 0, { dirs: 1 })
  }
  const unique = [...new Map(list.map((c) => [c.name, c])).values()]
  return { base, list: sortCompanions(unique) }
}

export const archiveCompanions = (
  entries: ZipEntry[],
  entryName: string,
): { base: string; list: Companion[] } => {
  // Dans une archive, la racine est « . » : le parent de n'importe quel dossier y reste.
  const dir = path.posix.dirname(entryName)
  const base = dir === '.' ? '.' : path.posix.dirname(dir)
  const prefix = base === '.' ? '' : `${base}/`
  const list: Companion[] = []
  for (const entry of entries) {
    const kind = companionKind(entry.name)
    if (
      !kind ||
      !entry.name.startsWith(prefix) ||
      entry.name.startsWith('__MACOSX/')
    ) {
      continue
    }
    const rest = entry.name.slice(prefix.length)
    if (rest.split('/').length <= 3) {
      list.push({ name: rest, kind, size: entry.size })
    }
  }
  return { base: prefix, list: sortCompanions(list) }
}
