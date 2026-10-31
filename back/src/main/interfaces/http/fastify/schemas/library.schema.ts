import { z } from 'zod'

export const sourceSchema = z.object({
  id: z.number(),
  path: z.string(),
  created_at: z.string(),
})
export const addSourceBodySchema = z.object({ path: z.string().min(1) })
export const sourceIdParamsSchema = z.object({ id: z.coerce.number().int() })

export const fileSchema = z.object({
  path: z.string(),
  source_id: z.number(),
  name: z.string(),
  dir: z.string(),
  ext: z.string(),
  size: z.number(),
  mtime: z.number(),
  hash: z.string(),
  archive: z.string().nullable(),
})

export const scanStatusSchema = z.object({
  running: z.boolean(),
  measuring: z.number(),
  processed: z.number(),
  current: z.string().nullable(),
  lastFinishedAt: z.number().nullable(),
  errors: z.number(),
})

export const pathQuerySchema = z.object({ path: z.string().min(1) })
export const thumbnailParamsSchema = z.object({
  hash: z.string().regex(/^[0-9a-f]{40}$/),
})
export const thumbnailQuerySchema = z.object({ path: z.string().optional() })

export const companionQuerySchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
})
export const companionSchema = z.object({
  name: z.string(),
  kind: z.enum(['image', 'pdf', 'text']),
  size: z.number(),
})
export const plateThumbnailQuerySchema = z.object({
  path: z.string().min(1),
  index: z.coerce.number().int().min(1).max(999),
})
const filamentSchema = z.object({ color: z.string(), type: z.string() })
export const printInfoSchema = z.object({
  slicer: z.enum(['bambu', 'prusa']).nullable(),
  printer: z.string().nullable(),
  layerHeight: z.number().nullable(),
  filaments: z.array(filamentSchema),
  plates: z.array(
    z.object({
      index: z.number(),
      name: z.string(),
      objectIds: z.array(z.string()),
      seconds: z.number().nullable(),
      grams: z.number().nullable(),
      filaments: z.array(filamentSchema.extend({ grams: z.number() })),
    }),
  ),
  objects: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      extruder: z.number(),
      parts: z.array(z.object({ id: z.string(), extruder: z.number() })),
    }),
  ),
})

export const dimensionsSchema = z.object({
  hash: z.string(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
})
