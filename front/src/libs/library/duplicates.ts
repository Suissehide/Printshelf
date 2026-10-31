import type { Model } from '../../types/library.ts'

export type DuplicateGroup = {
  key: string
  kind: 'exact' | 'probable'
  keep: Model
  others: Model[]
  // Place récupérable en supprimant les autres copies (exactes uniquement).
  reclaimable: number
}

// « dragon (1).stl », « Dragon copie.STL », « dragon_final_FINAL.stl » → « dragon »
export const baseModelName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[\s_-]*(\(\d+\)|copy|copie|kopie|final|v\d+|\d+)$/g, '')
    .replace(/[\s_-]*(\(\d+\)|copy|copie|kopie|final|v\d+)$/g, '')
    .replace(/[\s_-]+/g, ' ')
    .trim()

// La copie à garder : hors archive d'abord, puis le nom le plus propre, puis la plus ancienne.
const keeperScore = (m: Model) =>
  [m.archive ? 1 : 0, m.name.length, m.mtime] as const

const pickKeeper = (models: Model[]) =>
  [...models].sort((a, b) => {
    const [x, y] = [keeperScore(a), keeperScore(b)]
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
  })

export const findDuplicates = (models: Model[]): DuplicateGroup[] => {
  const groups: DuplicateGroup[] = []

  const byHash = Map.groupBy(models, (m) => m.hash)
  for (const [hash, copies] of byHash) {
    if (copies.length > 1) {
      const [keep, ...others] = pickKeeper(copies)
      groups.push({
        key: hash,
        kind: 'exact',
        keep,
        others,
        reclaimable: others.reduce((s, m) => s + m.size, 0),
      })
    }
  }

  // Doublons probables : même nom de base et même format, mais contenu différent.
  // Une seule copie par hash, pour ne pas reconsidérer les doublons exacts déjà listés.
  const oneByHash = [...byHash.values()].map((copies) => pickKeeper(copies)[0])
  for (const [key, similar] of Map.groupBy(
    oneByHash,
    (m) => `${m.ext}:${baseModelName(m.name)}`,
  )) {
    if (similar.length > 1 && key.split(':')[1].length >= 3) {
      const [keep, ...others] = pickKeeper(similar)
      groups.push({ key, kind: 'probable', keep, others, reclaimable: 0 })
    }
  }

  return groups.sort((a, b) =>
    a.kind === b.kind
      ? b.reclaimable - a.reclaimable
      : a.kind === 'exact'
        ? -1
        : 1,
  )
}
