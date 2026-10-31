import { z } from 'zod'

const hash = z.string().regex(/^[0-9a-f]{40}$/)
const color = z.string().regex(/^#[0-9a-f]{6}$/i)

export const hashParamsSchema = z.object({ hash })
export const idParamsSchema = z.object({ id: z.string().min(1) })

export const modelMetaSchema = z.object({
  hash: z.string(),
  tags: z.array(z.string()),
  notes: z.string(),
  favorite: z.boolean(),
  sentAt: z.number().nullable(),
  sentCount: z.number(),
  creator: z.string(),
  sourceUrl: z.string(),
})
export const updateMetaBodySchema = z.object({
  tags: z.array(z.string().max(60)).max(50).optional(),
  notes: z.string().max(10_000).optional(),
  favorite: z.boolean().optional(),
  creator: z.string().trim().max(120).optional(),
  // Lien vers la page du modèle : http(s) uniquement (jamais javascript: ni file:), ou vide.
  sourceUrl: z
    .union([z.literal(''), z.url({ protocol: /^https?$/ }).max(500)])
    .optional(),
})

export const collectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  hashes: z.array(z.string()),
})
export const createCollectionBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  color,
})
export const updateCollectionBodySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  color: color.optional(),
})
export const collectionModelsBodySchema = z.object({
  hashes: z.array(hash).min(1),
  included: z.boolean(),
})

export const queueStatusSchema = z.enum(['TODO', 'PRINTING', 'DONE', 'FAILED'])
export const queueItemSchema = z.object({
  id: z.string(),
  hash: z.string(),
  name: z.string(),
  status: queueStatusSchema,
  quantity: z.number(),
  createdAt: z.number(),
})
export const addQueueBodySchema = z.object({
  hash,
  name: z.string().min(1).max(300),
  quantity: z.number().int().min(1).max(999).default(1),
})
export const updateQueueBodySchema = z.object({
  status: queueStatusSchema.optional(),
  quantity: z.number().int().min(1).max(999).optional(),
})

// Préférences synchronisées entre ordinateurs.
export const slicerPreferencesSchema = z.object({
  // Slicer utilisé par défaut ; null = le premier détecté.
  defaultSlicerId: z.string().max(80).nullable(),
  // Un modèle portant ce tag part vers ce slicer (ex. « résine » → Lychee).
  tagRules: z
    .array(
      z.object({
        tag: z.string().trim().min(1).max(60),
        slicerId: z.string().max(80),
      }),
    )
    .max(30),
})
export const printerSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(60),
  // Volume d'impression en mm : X (largeur), Y (profondeur), Z (hauteur).
  x: z.number().positive().max(5000),
  y: z.number().positive().max(5000),
  z: z.number().positive().max(5000),
})
export const printersSchema = z.array(printerSchema).max(20)
export const preferencesSchema = z.object({
  slicers: slicerPreferencesSchema,
  printers: printersSchema,
})
