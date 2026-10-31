import { bufferSource, listEntries, readEntry } from './zip-reader.ts'

// « À propos » d'un modèle : d'où il vient et qui l'a créé.
// - Un 3MF porte ces infos dans les métadonnées du modèle principal (spécification 3MF : Title,
//   Designer, Description, Copyright, LicenseTerms ; Bambu Studio / MakerWorld ajoutent License et
//   Origin). La description MakerWorld est du HTML : on n'en garde que le texte.
// - Un pack téléchargé contient souvent un readme / LICENSE avec le lien de la page du modèle
//   (Thingiverse : « Nom by Créateur on Thingiverse: https://www.thingiverse.com/thing:123 »).
// Rien n'est inventé : un lien n'est retenu que s'il est réellement écrit dans un fichier.

export type About = {
  title: string | null
  designer: string | null
  description: string | null
  license: string | null
  origin: string | null
}

export const EMPTY_ABOUT: About = {
  title: null,
  designer: null,
  description: null,
  license: null,
  origin: null,
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}
const decodeEntities = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n =
        code[1].toLowerCase() === 'x'
          ? Number.parseInt(code.slice(2), 16)
          : Number(code.slice(1))
      return Number.isFinite(n) ? String.fromCodePoint(n) : match
    }
    return ENTITIES[code.toLowerCase()] ?? match
  })

// Texte lisible d'un fragment HTML (ou de texte simple), paragraphes conservés.
export const htmlToText = (html: string): string =>
  decodeEntities(
    decodeEntities(html) // les métadonnées 3MF encodent le HTML lui-même
      .replace(/<\s*(br|\/p|\/div|\/li|\/h\d)\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*/g, '\n\n')
    .trim()

const clean = (value: string | undefined, max: number) => {
  const text = value ? htmlToText(value) : ''
  return text ? text.slice(0, max) : null
}

const HTTP_URL = /^https?:\/\/[^\s"'<>]+$/i

export const aboutFrom3mf = async (data: Buffer): Promise<About> => {
  const source = bufferSource(data)
  const entries = await listEntries(source)
  const main =
    entries.find((e) => /^3D\/3dmodel\.model$/i.test(e.name)) ??
    entries.find((e) => /\.model$/i.test(e.name))
  if (!main) {
    return EMPTY_ABOUT
  }
  // Les métadonnées sont en tête du fichier, avant le maillage : inutile de tout décoder.
  const xml = (await readEntry(source, main)).toString('utf8', 0, 512 * 1024)
  const end = xml.search(/<resources\b/)
  const head = end > 0 ? xml.slice(0, end) : xml
  const meta = new Map<string, string>()
  for (const [, name, value] of head.matchAll(
    /<metadata\b[^>]*\bname="([^"]+)"[^>]*>([\s\S]*?)<\/metadata>/g,
  )) {
    meta.set(name.toLowerCase().replace(/^\w+:/, ''), value)
  }
  const origin = clean(meta.get('origin'), 500)
  return {
    title: clean(meta.get('title'), 200),
    designer: clean(meta.get('designer'), 120),
    description: clean(meta.get('description'), 4000),
    license: clean(
      meta.get('license') ?? meta.get('licenseterms') ?? meta.get('copyright'),
      200,
    ),
    origin: origin && HTTP_URL.test(origin) ? origin : null,
  }
}

// Pages de modèles reconnues dans un texte (readme, LICENSE, attribution…).
const MODEL_PAGES = [
  /https?:\/\/(?:www\.)?thingiverse\.com\/thing:\d+/i,
  /https?:\/\/(?:www\.)?printables\.com\/(?:[a-z]{2}\/)?model\/\d+[\w-]*/i,
  /https?:\/\/(?:www\.)?makerworld\.com\/(?:[a-z]{2}\/)?models\/\d+[\w#/-]*/i,
  /https?:\/\/(?:www\.)?cults3d\.com\/(?:[a-z]{2}\/)?(?:3d-model|modele-3d)\/[\w/-]+/i,
  /https?:\/\/(?:www\.)?myminifactory\.com\/object\/[\w-]+/i,
]
const THINGIVERSE_ATTRIBUTION = /^(.+?) by (.+?) on Thingiverse:/m

export const detectSource = (
  texts: string[],
): Pick<About, 'origin' | 'designer'> => {
  let origin: string | null = null
  let designer: string | null = null
  for (const text of texts) {
    origin ??= MODEL_PAGES.map((p) => text.match(p)?.[0]).find(Boolean) ?? null
    designer ??=
      text.match(THINGIVERSE_ATTRIBUTION)?.[2].trim().slice(0, 120) ?? null
  }
  return { origin, designer }
}

// Les infos du 3MF priment ; le readme du pack complète ce qui manque.
export const mergeAbout = (
  fromModel: About,
  fromPack: Pick<About, 'origin' | 'designer'>,
): About => ({
  ...fromModel,
  designer: fromModel.designer ?? fromPack.designer,
  origin: fromModel.origin ?? fromPack.origin,
})
