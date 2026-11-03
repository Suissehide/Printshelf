import { type FormEvent, useEffect, useRef, useSyncExternalStore } from 'react'

import { fieldClass } from '@/components/settings/panel.tsx'
import { Button } from '@/components/ui/button.tsx'

// Fenêtres de saisie et de confirmation, à la place de window.prompt / window.confirm.
// Même principe que les toasts : un store minimal, un seul <Dialogs /> monté à la racine,
// et des fonctions qui renvoient une promesse. <dialog> natif : focus piégé et Échap gratuits.

type Request = {
  title: string
  message?: string
  placeholder?: string
  input: boolean
  confirmLabel: string
  danger?: boolean
  resolve: (value: string | null) => void
}

let current: Request | null = null
const listeners = new Set<() => void>()
const emit = () => {
  for (const l of listeners) {
    l()
  }
}

const settle = (value: string | null) => {
  current?.resolve(value)
  current = null
  emit()
}

const open = (request: Omit<Request, 'resolve'>) =>
  new Promise<string | null>((resolve) => {
    current?.resolve(null)
    current = { ...request, resolve }
    emit()
  })

// Texte saisi (sans espaces autour), ou null si annulé.
export const promptDialog = (
  title: string,
  { placeholder, confirmLabel = 'Valider' } = {} as {
    placeholder?: string
    confirmLabel?: string
  },
) =>
  open({ title, placeholder, confirmLabel, input: true }).then(
    (value) => value?.trim() || null,
  )

export const confirmDialog = (
  title: string,
  { message, confirmLabel = 'Confirmer', danger = false } = {} as {
    message?: string
    confirmLabel?: string
    danger?: boolean
  },
) =>
  open({ title, message, confirmLabel, danger, input: false }).then(
    (value) => value !== null,
  )

export const Dialogs = () => {
  const request = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
  )
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (request) {
      ref.current?.showModal()
    }
  }, [request])

  if (!request) {
    return null
  }

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    settle(String(new FormData(e.currentTarget).get('value') ?? ''))
  }

  return (
    <dialog
      ref={ref}
      onClose={() => settle(null)}
      onMouseDown={(e) => e.target === e.currentTarget && settle(null)}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-line-strong bg-overlay p-0 text-ink shadow-(--shadow-pop) backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
    >
      <form onSubmit={submit} className="flex flex-col gap-4 p-5">
        <h2 className="text-[15px] font-semibold">{request.title}</h2>
        {request.message && (
          <p className="-mt-2 text-ink-soft">{request.message}</p>
        )}
        {request.input && (
          <input
            name="value"
            required
            autoComplete="off"
            placeholder={request.placeholder}
            maxLength={120}
            className={fieldClass}
          />
        )}
        <div className="flex justify-end gap-2">
          <Button onClick={() => settle(null)}>Annuler</Button>
          <Button
            type="submit"
            variant="primary"
            className={
              request.danger
                ? 'bg-danger text-white hover:brightness-110'
                : undefined
            }
          >
            {request.confirmLabel}
          </Button>
        </div>
      </form>
    </dialog>
  )
}
