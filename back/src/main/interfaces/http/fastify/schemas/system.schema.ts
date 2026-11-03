import { z } from 'zod'

export const slicerSchema = z.object({ id: z.string(), name: z.string() })
export const openBodySchema = z.object({
  paths: z.array(z.string().min(1)).min(1).max(50),
  slicerId: z.string().optional(),
})
export const revealBodySchema = z.object({ path: z.string().min(1) })
export const groupFolderBodySchema = z.object({
  paths: z.array(z.string().min(1)).min(1).max(200),
  name: z.string().trim().min(1).max(100),
})
export const groupFolderResultSchema = z.object({
  folder: z.string(),
  moved: z.array(z.object({ from: z.string(), to: z.string() })),
})

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

const httpsUrl = z.url({ protocol: /^https?$/ }).max(2000)
export const importBodySchema = z.object({
  path: z.string().min(1).max(4096),
  pageUrl: httpsUrl,
  title: z.string().max(300).optional(),
  creator: z.string().max(120).optional(),
  imageUrl: httpsUrl.optional(),
  description: z.string().max(20_000).optional(),
})
export const importResultSchema = z.object({
  folder: z.string(),
  file: z.string(),
  models: z.number(),
})
export const importFolderSchema = z.object({ folder: z.string().nullable() })
export const setImportFolderBodySchema = z.object({
  folder: z.string().min(1).nullable(),
})
