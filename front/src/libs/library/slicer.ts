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

// Imprimantes courantes (volume d'impression en mm), proposées à l'ajout, groupées par marque
// (premier mot du nom).
export const PRINTER_PRESETS: Omit<Printer, 'id'>[] = [
  { name: 'Bambu Lab A1 mini', x: 180, y: 180, z: 180 },
  { name: 'Bambu Lab A1', x: 256, y: 256, z: 256 },
  { name: 'Bambu Lab P1P / P1S', x: 256, y: 256, z: 256 },
  { name: 'Bambu Lab P2S', x: 256, y: 256, z: 256 },
  { name: 'Bambu Lab X1C / X1E', x: 256, y: 256, z: 256 },
  { name: 'Bambu Lab H2D', x: 350, y: 320, z: 325 },
  { name: 'Bambu Lab H2S', x: 340, y: 320, z: 340 },
  { name: 'Elegoo Centauri Carbon', x: 256, y: 256, z: 256 },
  { name: 'Elegoo Centauri Carbon 2', x: 256, y: 256, z: 256 },
  { name: 'Elegoo Neptune 4 / 4 Pro', x: 225, y: 225, z: 265 },
  { name: 'Elegoo Neptune 4 Plus', x: 320, y: 320, z: 385 },
  { name: 'Elegoo Neptune 4 Max', x: 420, y: 420, z: 480 },
  { name: 'Elegoo Neptune 3', x: 220, y: 220, z: 280 },
  { name: 'Elegoo Neptune 3 Pro', x: 225, y: 225, z: 280 },
  { name: 'Elegoo Neptune 3 Plus', x: 320, y: 320, z: 400 },
  { name: 'Elegoo Neptune 3 Max', x: 420, y: 420, z: 500 },
  { name: 'Elegoo Neptune 2', x: 220, y: 220, z: 250 },
  { name: 'Elegoo OrangeStorm Giga', x: 800, y: 800, z: 1000 },
  { name: 'Elegoo Saturn 4 Ultra 16K (résine)', x: 211, y: 118, z: 220 },
  { name: 'Elegoo Saturn 4 Ultra (résine)', x: 218, y: 123, z: 220 },
  { name: 'Elegoo Saturn 4 (résine)', x: 218, y: 122, z: 210 },
  { name: 'Elegoo Saturn 3 Ultra (résine)', x: 218, y: 123, z: 260 },
  { name: 'Elegoo Saturn 3 (résine)', x: 218, y: 123, z: 250 },
  { name: 'Elegoo Saturn 2 (résine)', x: 219, y: 123, z: 250 },
  { name: 'Elegoo Mars 5 Ultra (résine)', x: 153, y: 77, z: 165 },
  { name: 'Elegoo Mars 5 (résine)', x: 143, y: 89, z: 150 },
  { name: 'Elegoo Mars 4 Ultra (résine)', x: 153, y: 77, z: 165 },
  { name: 'Elegoo Mars 4 (résine)', x: 133, y: 75, z: 150 },
  { name: 'Elegoo Jupiter (résine)', x: 278, y: 156, z: 300 },
  { name: 'Prusa MK4 / MK4S', x: 250, y: 210, z: 220 },
  { name: 'Prusa MK3S+', x: 250, y: 210, z: 210 },
  { name: 'Prusa MINI+', x: 180, y: 180, z: 180 },
  { name: 'Prusa Core One', x: 250, y: 220, z: 270 },
  { name: 'Prusa XL', x: 360, y: 360, z: 360 },
  { name: 'Prusa SL1S (résine)', x: 127, y: 80, z: 150 },
  { name: 'Creality Ender-3 V3 / V3 SE', x: 220, y: 220, z: 250 },
  { name: 'Creality Ender-3 V3 KE', x: 220, y: 220, z: 240 },
  { name: 'Creality Ender-3 V3 Plus', x: 300, y: 300, z: 330 },
  { name: 'Creality Ender-3 V2', x: 220, y: 220, z: 250 },
  { name: 'Creality Ender-3 S1 / S1 Pro', x: 220, y: 220, z: 270 },
  { name: 'Creality Ender-5 S1', x: 220, y: 220, z: 280 },
  { name: 'Creality K1 / K1C', x: 220, y: 220, z: 250 },
  { name: 'Creality K1 Max', x: 300, y: 300, z: 300 },
  { name: 'Creality K2 Pro', x: 300, y: 300, z: 300 },
  { name: 'Creality K2 Plus', x: 350, y: 350, z: 350 },
  { name: 'Creality Hi', x: 260, y: 260, z: 300 },
  { name: 'Creality CR-10 SE', x: 220, y: 220, z: 265 },
  { name: 'Anycubic Kobra 3', x: 250, y: 250, z: 260 },
  { name: 'Anycubic Kobra 3 Max', x: 420, y: 420, z: 500 },
  { name: 'Anycubic Kobra S1', x: 250, y: 250, z: 250 },
  { name: 'Anycubic Kobra 2 Neo / 2 Pro', x: 220, y: 220, z: 250 },
  { name: 'Anycubic Kobra 2 Max', x: 420, y: 420, z: 500 },
  { name: 'Anycubic Photon Mono M7 Pro (résine)', x: 223, y: 126, z: 230 },
  { name: 'Anycubic Photon Mono M5s (résine)', x: 218, y: 123, z: 200 },
  { name: 'Sovol SV06', x: 220, y: 220, z: 250 },
  { name: 'Sovol SV06 Plus', x: 300, y: 300, z: 340 },
  { name: 'Sovol SV07', x: 220, y: 220, z: 250 },
  { name: 'Sovol SV08', x: 350, y: 350, z: 345 },
  { name: 'Qidi Q1 Pro', x: 245, y: 245, z: 240 },
  { name: 'Qidi Plus4', x: 305, y: 305, z: 280 },
  { name: 'Qidi X-Plus 3', x: 280, y: 280, z: 270 },
  { name: 'Qidi X-Max 3', x: 325, y: 325, z: 315 },
  { name: 'Flashforge Adventurer 5M / AD5X', x: 220, y: 220, z: 220 },
  { name: 'Snapmaker J1', x: 300, y: 200, z: 200 },
  { name: 'Snapmaker Artisan', x: 400, y: 400, z: 400 },
  { name: 'Artillery Sidewinder X2', x: 300, y: 300, z: 400 },
  { name: 'Artillery Genius Pro', x: 220, y: 220, z: 250 },
  { name: 'UltiMaker S3', x: 230, y: 190, z: 200 },
  { name: 'UltiMaker S5', x: 330, y: 240, z: 300 },
  { name: 'Voron 2.4 (300)', x: 300, y: 300, z: 280 },
  { name: 'Voron 2.4 (350)', x: 350, y: 350, z: 340 },
]
