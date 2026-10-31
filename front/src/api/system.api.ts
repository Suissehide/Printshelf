import type { Slicer, SyncStatus } from '../types/library.ts'
import { request } from './http.ts'

export type Capabilities = { desktop: boolean; sourcesRoot: string | null }

export const SystemApi = {
  getCapabilities: () => request<Capabilities>('/system/capabilities'),
  pickFolder: () =>
    request<{ path: string }>('/system/pick-folder', {
      method: 'POST',
      json: {},
    }),
  getSlicers: () => request<Slicer[]>('/system/slicers'),
  refreshSlicers: () =>
    request<Slicer[]>('/system/slicers/refresh', { method: 'POST', json: {} }),
  open: (paths: string[], slicerId?: string) =>
    request('/system/open', { method: 'POST', json: { paths, slicerId } }),
  reveal: (path: string) =>
    request('/system/reveal', { method: 'POST', json: { path } }),

  getSync: () => request<SyncStatus>('/sync'),
  setSyncFolder: (folder: string | null) =>
    request<SyncStatus>('/sync', { method: 'PUT', json: { folder } }),
  syncNow: () => request<SyncStatus>('/sync/now', { method: 'POST', json: {} }),
  restore: (backup: unknown) =>
    request<{ changed: number }>('/sync/restore', {
      method: 'POST',
      json: backup,
    }),
  backupUrl: '/api/sync/backup',
}
