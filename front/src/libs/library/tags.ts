import type { Model } from '../../types/library.ts'

// Mots qui n'aident pas à trier : formats, mots de rangement, numéros de version.
const STOP_WORDS = new Set([
  'stl',
  '3mf',
  'obj',
  'ply',
  'glb',
  'step',
  'stp',
  'gcode',
  'zip',
  'rar',
  '7z',
  'files',
  'file',
  'fichiers',
  'fichier',
  'model',
  'models',
  'modele',
  'modeles',
  'modèle',
  'modèles',
  'print',
  'prints',
  'printing',
  'impression',
  'impressions',
  'download',
  'downloads',
  'téléchargements',
  'telechargements',
  'importés',
  'printshelf',
  'the',
  'and',
  'for',
  'with',
  'les',
  'des',
  'pour',
  'avec',
  'final',
  'copy',
  'copie',
  'new',
  'old',
  'test',
  'part',
  'parts',
  'pièce',
])

const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(
      (w) =>
        w.length >= 3 &&
        !/^\d+$/.test(w) &&
        !/^v\d+$/.test(w) &&
        !STOP_WORDS.has(w),
    )

// Tags proposés pour un modèle, tirés des dossiers sous la source, de l'archive et du nom de
// fichier. Les tags déjà utilisés ailleurs dans la bibliothèque passent devant.
export const suggestTags = (
  model: Pick<Model, 'path' | 'tags'>,
  sourcePath: string | undefined,
  libraryTags: string[],
  limit = 6,
): string[] => {
  const norm = (p: string) => p.replaceAll('\\', '/')
  let relative = norm(model.path)
  if (sourcePath && relative.startsWith(`${norm(sourcePath)}/`)) {
    relative = relative.slice(norm(sourcePath).length + 1)
  }
  const candidates = [
    ...new Set(words(relative.replace(/\.[a-z0-9]+$/i, ''))),
  ].filter((w) => !model.tags.includes(w))
  const known = new Set(libraryTags)
  return [
    ...candidates.filter((w) => known.has(w)),
    ...candidates.filter((w) => !known.has(w)),
  ].slice(0, limit)
}
