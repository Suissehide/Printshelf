import type {
  Dimensions,
  Model,
  Printer,
  Slicer,
  SlicerPreferences,
} from '../../types/library.ts'

// Slicer d'un modèle : la première règle dont le tag est porté par le modèle, sinon le slicer
// par défaut, sinon le premier détecté. Une préférence qui vise un slicer absent de CET ordinateur
// (préférences synchronisées) est ignorée. `undefined` = application par défaut du système.
export const resolveSlicer = (
  model: Pick<Model, 'tags'>,
  prefs: SlicerPreferences | undefined,
  slicers: Slicer[],
): string | undefined => {
  const installed = (id: string | null | undefined) =>
    id && slicers.some((s) => s.id === id) ? id : undefined
  const rule = prefs?.tagRules.find(
    (r) => model.tags.includes(r.tag) && installed(r.slicerId),
  )
  return rule?.slicerId ?? installed(prefs?.defaultSlicerId) ?? slicers[0]?.id
}

// Regroupe des modèles par slicer cible : un seul appel (donc un seul plateau) par slicer.
export const groupBySlicer = <M extends Pick<Model, 'tags'>>(
  models: M[],
  prefs: SlicerPreferences | undefined,
  slicers: Slicer[],
): Map<string | undefined, M[]> =>
  Map.groupBy(models, (m) => resolveSlicer(m, prefs, slicers))

// Le modèle tient-il dans le volume d'impression ? Une rotation d'un quart de tour sur le
// plateau (X ↔ Y) est permise ; la hauteur, elle, est fixe.
export const fitsOn = (dims: Dimensions, printer: Printer): boolean =>
  dims.z <= printer.z &&
  ((dims.x <= printer.x && dims.y <= printer.y) ||
    (dims.y <= printer.x && dims.x <= printer.y))

// Imprimantes courantes (volume d'impression en mm), proposées à l'ajout.
export const PRINTER_PRESETS: Omit<Printer, 'id'>[] = [
  { name: 'Bambu Lab A1 mini', x: 180, y: 180, z: 180 },
  { name: 'Bambu Lab A1', x: 256, y: 256, z: 256 },
  { name: 'Bambu Lab P1S / P1P / X1C', x: 256, y: 256, z: 256 },
  { name: 'Bambu Lab H2D', x: 350, y: 320, z: 325 },
  { name: 'Prusa MK4 / MK4S', x: 250, y: 210, z: 220 },
  { name: 'Prusa MINI+', x: 180, y: 180, z: 180 },
  { name: 'Prusa Core One', x: 250, y: 220, z: 270 },
  { name: 'Creality Ender-3 V3', x: 220, y: 220, z: 250 },
  { name: 'Creality K1 / K1C', x: 220, y: 220, z: 250 },
  { name: 'Elegoo Saturn 4 Ultra (résine)', x: 218, y: 123, z: 220 },
  { name: 'Anycubic Photon Mono M7 Pro (résine)', x: 223, y: 126, z: 230 },
]
