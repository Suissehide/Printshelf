import type {
  About,
  Companion,
  FileRow,
  Measured,
  PrintInfo,
  ScanStatus,
  Source,
} from '../types/library.ts'
import { API, pathQuery, request } from './http.ts'

export const LibraryApi = {
  getSources: () => request<Source[]>('/sources'),
  addSource: (path: string) =>
    request<Source>('/sources', { method: 'POST', json: { path } }),
  removeSource: (id: number) => request(`/sources/${id}`, { method: 'DELETE' }),

  getScan: () => request<ScanStatus>('/scan'),
  startScan: () => request<ScanStatus>('/scan', { method: 'POST', json: {} }),

  getFiles: () => request<FileRow[]>('/files'),
  getAbout: () => request<(About & { hash: string })[]>('/about'),
  getDimensions: () => request<(Measured & { hash: string })[]>('/dimensions'),
  getContent: async (path: string): Promise<ArrayBuffer> => {
    const response = await fetch(`${API}/files/content?${pathQuery(path)}`)
    if (!response.ok) {
      throw new Error('Impossible de lire ce fichier')
    }
    return response.arrayBuffer()
  },

  getCompanions: (path: string) =>
    request<Companion[]>(`/files/companions?${pathQuery(path)}`),
  companionUrl: (path: string, name: string) =>
    `${API}/files/companion?${pathQuery(path)}&name=${encodeURIComponent(name)}`,
  getPrintInfo: (path: string) =>
    request<PrintInfo>(`/files/print-info?${pathQuery(path)}`),
  plateThumbnailUrl: (path: string, index: number) =>
    `${API}/files/plate-thumbnail?${pathQuery(path)}&index=${index}`,
  downloadUrl: (path: string) => `${API}/files/download?${pathQuery(path)}`,
  thumbnailUrl: (hash: string, path: string) =>
    `${API}/thumbnails/${hash}?${pathQuery(path)}`,
  putThumbnail: (hash: string, png: Blob) =>
    request(`/thumbnails/${hash}`, {
      method: 'PUT',
      body: png,
      headers: { 'Content-Type': 'image/png' },
    }),
}
