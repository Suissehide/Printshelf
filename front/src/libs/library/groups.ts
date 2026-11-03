import type { Model } from '../../types/library.ts'

// Pièces d'un même objet : fichiers voisins (même dossier, hors archive) dont le nom commence
// pareil — « repose_casque_base.stl », « repose_casque_bras.stl »… Proposées pour être rangées
// ensemble dans un dossier à leur nom commun. Rien n'est proposé si elles sont déjà dans un
// dossier qui porte ce nom.

const squash = (text: string) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

const tokens = (name: string) =>
  name
    .replace(/\.[a-z0-9]+$/i, '')
    .split(/[\s_.-]+/)
    .filter(Boolean)

export type RelatedGroup = { name: string; models: Model[] }

export const relatedParts = (
  model: Model,
  models: Model[],
): RelatedGroup | null => {
  if (model.archive) {
    return null
  }
  const neighbours = models.filter((m) => !m.archive && m.dir === model.dir)
  const own = tokens(model.name)
  // Le plus long préfixe (en mots, sans le dernier) partagé avec au moins un voisin.
  for (let k = own.length - 1; k >= 1; k--) {
    const prefix = own.slice(0, k).map((t) => t.toLowerCase())
    if (prefix.join(' ').length < 4) {
      break
    }
    const parts = neighbours.filter((m) => {
      const other = tokens(m.name).map((t) => t.toLowerCase())
      return other.length > k && prefix.every((t, i) => other[i] === t)
    })
    if (parts.length >= 2) {
      const name = own.slice(0, k).join(' ')
      const folder = model.dir.split(/[\\/]/).pop() ?? ''
      return squash(folder).includes(squash(name))
        ? null
        : { name, models: parts }
    }
  }
  return null
}

// Nom proposé pour le dossier d'une sélection : le début de nom commun à tous les fichiers,
// sinon le nom du premier.
export const commonName = (models: Pick<Model, 'name'>[]): string => {
  const [first, ...rest] = models.map((m) => tokens(m.name))
  if (!first) {
    return ''
  }
  let k = first.length
  for (const other of rest) {
    let i = 0
    while (
      i < k &&
      i < other.length &&
      other[i].toLowerCase() === first[i].toLowerCase()
    ) {
      i++
    }
    k = i
  }
  return (k ? first.slice(0, k) : first).join(' ')
}
