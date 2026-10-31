import { useSyncExternalStore } from 'react'

export type Toast = { id: number; message: string; tone: 'info' | 'error' }

let toasts: Toast[] = []
const listeners = new Set<() => void>()
const emit = () => {
  for (const l of listeners) {
    l()
  }
}

export const toast = (message: string, tone: Toast['tone'] = 'info') => {
  const id = Date.now() + Math.random()
  toasts = [...toasts, { id, message, tone }]
  emit()
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    emit()
  }, 3500)
}

export const toastError = (error: unknown) =>
  toast(error instanceof Error ? error.message : String(error), 'error')

export const useToasts = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => toasts,
  )
