export const QUERY_KEYS = {
  SOURCES: ['sources'],
  SCAN: ['scan'],
  FILES: ['files'],
  METAS: ['metas'],
  COLLECTIONS: ['collections'],
  QUEUE: ['queue'],
  SLICERS: ['slicers'],
  SYNC: ['sync'],
  CAPABILITIES: ['capabilities'],
  COMPANIONS: ['companions'],
  PRINT_INFO: ['print-info'],
  DIMENSIONS: ['dimensions'],
  PREFERENCES: ['preferences'],
} as const

// Ce qui peut changer quand une autre machine synchronise.
export const SYNCED_KEYS = [
  QUERY_KEYS.METAS,
  QUERY_KEYS.COLLECTIONS,
  QUERY_KEYS.QUEUE,
  QUERY_KEYS.PREFERENCES,
]
