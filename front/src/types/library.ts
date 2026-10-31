export type Source = { id: number; path: string; created_at: string }

export type FileRow = {
  path: string
  source_id: number
  name: string
  dir: string
  ext: string
  size: number
  mtime: number
  hash: string
  archive: string | null
}

export type ScanStatus = {
  running: boolean
  measuring: number
  processed: number
  current: string | null
  lastFinishedAt: number | null
  errors: number
}

export type ModelMeta = {
  hash: string
  tags: string[]
  notes: string
  favorite: boolean
  sentAt: number | null
  sentCount: number
  creator: string
  sourceUrl: string
}

export type Collection = {
  id: string
  name: string
  color: string
  hashes: string[]
}

export type QueueStatus = 'TODO' | 'PRINTING' | 'DONE' | 'FAILED'
export type QueueItem = {
  id: string
  hash: string
  name: string
  status: QueueStatus
  quantity: number
  createdAt: number
}

export type Slicer = { id: string; name: string }

export type SyncStatus = {
  folder: string | null
  deviceId: string
  deviceName: string
  revision: number
  lastExportAt: number | null
  lastImportAt: number | null
  devices: { deviceId: string; deviceName: string; exportedAt: number }[]
  error: string | null
}

// Un fichier de l'index, enrichi de ce que l'utilisateur y a ajouté (synchronisé par hash).
export type Model = FileRow & {
  tags: string[]
  notes: string
  favorite: boolean
  collectionIds: string[]
  copies: number
  sentAt: number | null
  dims: Dimensions | null
  // Créateur et lien effectifs : saisis par l'utilisateur, sinon lus dans le fichier ou son pack.
  creator: string
  sourceUrl: string
  about: About | null
}

export type Companion = {
  name: string
  kind: 'image' | 'pdf' | 'text'
  size: number
}

export type Filament = { color: string; type: string }
export type PlateInfo = {
  index: number
  name: string
  objectIds: string[]
  seconds: number | null
  grams: number | null
  filaments: (Filament & { grams: number })[]
}
export type PrintInfo = {
  slicer: 'bambu' | 'prusa' | null
  printer: string | null
  layerHeight: number | null
  filaments: Filament[]
  plates: PlateInfo[]
  objects: {
    id: string
    name: string
    extruder: number
    parts: { id: string; extruder: number }[]
  }[]
}

export type Dimensions = { x: number; y: number; z: number }

export type Printer = Dimensions & { id: string; name: string }
export type SlicerPreferences = {
  defaultSlicerId: string | null
  tagRules: { tag: string; slicerId: string }[]
}
export type Preferences = { slicers: SlicerPreferences; printers: Printer[] }

// Lu dans le 3MF (métadonnées) ou dans les readme du pack.
export type About = {
  title: string | null
  designer: string | null
  description: string | null
  license: string | null
  origin: string | null
}
