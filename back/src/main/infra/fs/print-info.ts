import { type ByteSource, listEntries, readEntry } from './zip-reader.ts'

// Ce que les slicers enregistrent dans un 3MF, lu sans charger le maillage :
// - Bambu Studio / OrcaSlicer : `Metadata/model_settings.config` (plateaux, objets, extrudeur par
//   objet/pièce), `Metadata/project_settings.config` (JSON : couleurs et types de filament,
//   imprimante) et, si le projet a été tranché, `Metadata/slice_info.config` (durée, poids,
//   filament consommé par plateau).
// - PrusaSlicer : `Metadata/Slic3r_PE.config` (« ; clé = valeur ») et `Slic3r_PE_model.config`.
// Ces fichiers sont de petits XML/INI réguliers : des expressions régulières suffisent, sans
// dépendance de parseur XML côté Node.

export type Filament = { color: string; type: string }
export type PlateInfo = {
  index: number
  name: string
  objectIds: string[]
  // Présents seulement si le projet a été tranché.
  seconds: number | null
  grams: number | null
  filaments: { color: string; type: string; grams: number }[]
}
export type ObjectInfo = {
  id: string
  name: string
  extruder: number
  parts: { id: string; extruder: number }[]
}
export type PrintInfo = {
  slicer: 'bambu' | 'prusa' | null
  printer: string | null
  layerHeight: number | null
  filaments: Filament[]
  plates: PlateInfo[]
  objects: ObjectInfo[]
}

export const EMPTY_PRINT_INFO: PrintInfo = {
  slicer: null,
  printer: null,
  layerHeight: null,
  filaments: [],
  plates: [],
  objects: [],
}

const decode = (s: string) =>
  s
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')

const attr = (tag: string, name: string): string | undefined => {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`))
  return match ? decode(match[1]) : undefined
}

// `<metadata key="k" value="v"/>` directement sous un bloc (Bambu), ou avec `type="object"` (Prusa).
const metadata = (block: string): Map<string, string> => {
  const out = new Map<string, string>()
  for (const [tag] of block.matchAll(/<metadata\b[^>]*>/g)) {
    const key = attr(tag, 'key')
    if (key && !out.has(key)) {
      out.set(key, attr(tag, 'value') ?? '')
    }
  }
  return out
}

const blocks = (xml: string, tag: string) =>
  [...xml.matchAll(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'g'))].map(
    (m) => m[0],
  )
const openTag = (block: string) => block.slice(0, block.indexOf('>') + 1)
const number = (v: string | undefined) =>
  v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null
const color = (v: string) =>
  /^#[0-9a-f]{6}/i.test(v) ? v.slice(0, 7).toLowerCase() : '#d9d6d0'

const parseObjects = (xml: string): ObjectInfo[] =>
  blocks(xml, 'object').map((block) => {
    const head = openTag(block)
    const withoutParts = block.replace(/<(part|volume)\b[\s\S]*?<\/\1>/g, '')
    const meta = metadata(withoutParts)
    return {
      id: attr(head, 'id') ?? '',
      name: meta.get('name') ?? '',
      extruder: number(meta.get('extruder')) ?? 1,
      parts: blocks(block, 'part').map((part) => ({
        id: attr(openTag(part), 'id') ?? '',
        extruder: number(metadata(part).get('extruder')) ?? 0,
      })),
    }
  })

const parsePlates = (xml: string): PlateInfo[] =>
  blocks(xml, 'plate').map((block) => {
    const withoutInstances = block.replace(
      /<model_instance\b[\s\S]*?<\/model_instance>/g,
      '',
    )
    const meta = metadata(withoutInstances)
    return {
      index: number(meta.get('plater_id')) ?? 1,
      name: meta.get('plater_name') ?? '',
      objectIds: blocks(block, 'model_instance').map(
        (i) => metadata(i).get('object_id') ?? '',
      ),
      seconds: null,
      grams: null,
      filaments: [],
    }
  })

const applySliceInfo = (plates: PlateInfo[], xml: string) => {
  for (const block of blocks(xml, 'plate')) {
    const meta = metadata(block)
    const index = number(meta.get('index')) ?? 1
    let plate = plates.find((p) => p.index === index)
    if (!plate) {
      plate = {
        index,
        name: '',
        objectIds: [],
        seconds: null,
        grams: null,
        filaments: [],
      }
      plates.push(plate)
    }
    plate.seconds = number(meta.get('prediction'))
    plate.grams = number(meta.get('weight'))
    plate.filaments = [...block.matchAll(/<filament\b[^>]*>/g)].map(
      ([tag]) => ({
        color: color(attr(tag, 'color') ?? ''),
        type: attr(tag, 'type') ?? '',
        grams: number(attr(tag, 'used_g')) ?? 0,
      }),
    )
  }
}

const listValue = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split(';') : []

const filamentsFrom = (colors: string[], types: string[]): Filament[] =>
  colors.map((c, i) => ({ color: color(c), type: types[i] ?? types[0] ?? '' }))

const parsePrusaConfig = (text: string) => {
  const values = new Map<string, string>()
  for (const [, key, value] of text.matchAll(/^;\s*([\w-]+)\s*=\s*(.*)$/gm)) {
    values.set(key, value.trim())
  }
  return values
}

type EntryReader = (name: string) => Promise<string | null>

const readBambu = async (read: EntryReader): Promise<PrintInfo | null> => {
  const modelSettings = await read('Metadata/model_settings.config')
  const projectSettings = await read('Metadata/project_settings.config')
  const sliceInfo = await read('Metadata/slice_info.config')
  if (!(modelSettings || projectSettings || sliceInfo)) {
    return null
  }
  const info: PrintInfo = {
    ...EMPTY_PRINT_INFO,
    slicer: 'bambu',
    objects: modelSettings ? parseObjects(modelSettings) : [],
    plates: modelSettings ? parsePlates(modelSettings) : [],
  }
  if (projectSettings) {
    try {
      const settings = JSON.parse(projectSettings) as Record<string, unknown>
      info.filaments = filamentsFrom(
        listValue(settings.filament_colour),
        listValue(settings.filament_type),
      )
      info.printer =
        typeof settings.printer_model === 'string'
          ? settings.printer_model
          : null
      info.layerHeight = number(String(settings.layer_height ?? ''))
    } catch {
      // réglages illisibles : on garde le reste
    }
  }
  if (sliceInfo) {
    applySliceInfo(info.plates, sliceInfo)
  }
  info.plates.sort((a, b) => a.index - b.index)
  return info
}

const readPrusa = async (read: EntryReader): Promise<PrintInfo | null> => {
  const config = await read('Metadata/Slic3r_PE.config')
  if (!config) {
    return null
  }
  const values = parsePrusaConfig(config)
  const model = await read('Metadata/Slic3r_PE_model.config')
  return {
    ...EMPTY_PRINT_INFO,
    slicer: 'prusa',
    filaments: filamentsFrom(
      listValue(values.get('extruder_colour') || values.get('filament_colour')),
      listValue(values.get('filament_type')),
    ),
    printer:
      values.get('printer_model') || values.get('printer_settings_id') || null,
    layerHeight: number(values.get('layer_height')),
    objects: model ? parseObjects(model) : [],
  }
}

export const readPrintInfo = async (source: ByteSource): Promise<PrintInfo> => {
  const entries = await listEntries(source)
  const read: EntryReader = async (name) => {
    const entry = entries.find(
      (e) => e.name.toLowerCase() === name.toLowerCase(),
    )
    return entry ? (await readEntry(source, entry)).toString('utf8') : null
  }
  return (await readBambu(read)) ?? (await readPrusa(read)) ?? EMPTY_PRINT_INFO
}
