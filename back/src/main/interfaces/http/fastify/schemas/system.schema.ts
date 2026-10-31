import { z } from 'zod'

export const slicerSchema = z.object({ id: z.string(), name: z.string() })
export const openBodySchema = z.object({
  paths: z.array(z.string().min(1)).min(1).max(50),
  slicerId: z.string().optional(),
})
export const revealBodySchema = z.object({ path: z.string().min(1) })

export const syncStatusSchema = z.object({
  folder: z.string().nullable(),
  deviceId: z.string(),
  deviceName: z.string(),
  revision: z.number(),
  lastExportAt: z.number().nullable(),
  lastImportAt: z.number().nullable(),
  devices: z.array(
    z.object({
      deviceId: z.string(),
      deviceName: z.string(),
      exportedAt: z.number(),
    }),
  ),
  error: z.string().nullable(),
})
export const setSyncFolderBodySchema = z.object({
  folder: z.string().min(1).nullable(),
})
