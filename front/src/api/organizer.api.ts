import type {
  Collection,
  ModelMeta,
  Preferences,
  Printer,
  QueueItem,
  QueueStatus,
  SlicerPreferences,
} from '../types/library.ts'
import { request } from './http.ts'

export const OrganizerApi = {
  getMetas: () => request<ModelMeta[]>('/metas'),
  updateMeta: (hash: string, patch: Partial<Omit<ModelMeta, 'hash'>>) =>
    request<ModelMeta>(`/metas/${hash}`, { method: 'PATCH', json: patch }),

  getCollections: () => request<Collection[]>('/collections'),
  createCollection: (name: string, color: string) =>
    request<Collection>('/collections', {
      method: 'POST',
      json: { name, color },
    }),
  updateCollection: (id: string, patch: { name?: string; color?: string }) =>
    request(`/collections/${id}`, { method: 'PATCH', json: patch }),
  removeCollection: (id: string) =>
    request(`/collections/${id}`, { method: 'DELETE' }),
  setInCollection: (id: string, hashes: string[], included: boolean) =>
    request(`/collections/${id}/models`, {
      method: 'PUT',
      json: { hashes, included },
    }),

  getPreferences: () => request<Preferences>('/preferences'),
  setSlicerPreferences: (prefs: SlicerPreferences) =>
    request<Preferences>('/preferences/slicers', {
      method: 'PUT',
      json: prefs,
    }),
  setPrinters: (printers: Printer[]) =>
    request<Preferences>('/preferences/printers', {
      method: 'PUT',
      json: printers,
    }),

  getQueue: () => request<QueueItem[]>('/queue'),
  addToQueue: (hash: string, name: string) =>
    request('/queue', { method: 'POST', json: { hash, name } }),
  updateQueueItem: (
    id: string,
    patch: { status?: QueueStatus; quantity?: number },
  ) => request(`/queue/${id}`, { method: 'PATCH', json: patch }),
  removeQueueItem: (id: string) =>
    request(`/queue/${id}`, { method: 'DELETE' }),
}
