import fs from 'node:fs/promises'
import path from 'node:path'

// Nom de dossier sûr sur Mac, Windows et Linux.
export const safeName = (value: string, fallback = 'Modèle') =>
  value
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[ .]+|[ .]+$/g, '')
    .slice(0, 100) || fallback

export const exists = (p: string) =>
  fs.stat(p).then(
    () => true,
    () => false,
  )

// Chemin libre : « nom.stl », sinon « nom (2).stl », « nom (3).stl »… Jamais d'écrasement.
export const freePath = async (dir: string, name: string) => {
  const ext = path.extname(name)
  const base = name.slice(0, name.length - ext.length)
  let candidate = path.join(dir, name)
  for (let n = 2; await exists(candidate); n++) {
    candidate = path.join(dir, `${base} (${n})${ext}`)
  }
  return candidate
}

// Plus proche dossier parent commun à plusieurs dossiers.
export const commonDir = (dirs: string[]): string => {
  const [first, ...rest] = dirs.map((d) => path.resolve(d).split(path.sep))
  let length = first.length
  for (const parts of rest) {
    let i = 0
    while (i < length && i < parts.length && parts[i] === first[i]) {
      i++
    }
    length = i
  }
  return first.slice(0, length).join(path.sep) || path.sep
}
