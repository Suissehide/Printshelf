const units = ['o', 'Ko', 'Mo', 'Go', 'To']

export const formatSize = (bytes: number): string => {
  let value = bytes
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit++
  }
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: value < 10 && unit > 0 ? 1 : 0 })} ${units[unit]}`
}

export const formatDate = (ms: number): string =>
  new Date(ms).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

export const formatRelative = (ms: number | null): string => {
  if (!ms) {
    return 'jamais'
  }
  const seconds = Math.round((Date.now() - ms) / 1000)
  if (seconds < 60) {
    return "à l'instant"
  }
  if (seconds < 3600) {
    return `il y a ${Math.round(seconds / 60)} min`
  }
  if (seconds < 86_400) {
    return `il y a ${Math.round(seconds / 3600)} h`
  }
  return formatDate(ms)
}

export const plural = (
  n: number,
  singular: string,
  pluralForm = `${singular}s`,
) => `${n.toLocaleString('fr-FR')} ${n > 1 ? pluralForm : singular}`

// Dernier segment d'un chemin Mac ou Windows.
export const baseName = (path: string) =>
  path.split(/[\\/]/).filter(Boolean).pop() ?? path

export const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`
}

export const formatGrams = (grams: number): string =>
  `${grams.toLocaleString('fr-FR', { maximumFractionDigits: grams < 10 ? 1 : 0 })} g`

// Dossier affiché relativement à sa source : « Impression 3D › Jeux › Échecs » plutôt que le chemin
// absolu de la machine (qui reste disponible au survol). Chemins Mac comme Windows.
export const sourceRelativeDir = (
  dir: string,
  sources: { path: string }[],
): string => {
  const norm = (p: string) => p.replaceAll('\\', '/').replace(/\/+$/, '')
  const target = norm(dir)
  const source = sources
    .filter(
      (s) => target === norm(s.path) || target.startsWith(`${norm(s.path)}/`),
    )
    .sort((a, b) => b.path.length - a.path.length)[0]
  if (!source) {
    return dir
  }
  const rest = target.slice(norm(source.path).length).split('/').filter(Boolean)
  return [baseName(source.path), ...rest].join(' › ')
}
