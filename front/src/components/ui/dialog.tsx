import { type FormEvent, useEffect, useRef, useSyncExternalStore } from 'react'

import { fieldClass } from '@/components/settings/panel.tsx'
import { Button } from '@/components/ui/button.tsx'

// Fenêtres de saisie et de confirmation, à la place de window.prompt / window.confirm.
// Même principe que les toasts : un store minimal, un seul <Dialogs /> monté à la racine,
// et des fonctions qui renvoient une promesse. <dialog> natif : focus piégé et Échap gratuits.

export type DialogField = {
  name: string
  label?: string
  placeholder?: string
  type?: 'text' | 'url'
  required?: boolean
  maxLength?: number
  defaultValue?: string
}

type Values = Record<string, string>

type Request = {
  title: string
  message?: string
  fields: DialogField[]
  confirmLabel: string
  danger?: boolean
  resolve: (values: Values | null) => void
}

let current: Request | null = null
const listeners = new Set<() => void>()
const emit = () => {
  for (const l of listeners) {
    l()
  }
}

const settle = (values: Values | null) => {
  current?.resolve(values)
  current = null
  emit()
}

const open = (request: Omit<Request, 'resolve'>) =>
  new Promise<Values | null>((resolve) => {
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
  open({
    title,
    confirmLabel,
    fields: [{ name: 'value', placeholder, required: true }],
  }).then((values) => values?.value || null)

// Plusieurs champs (valeurs sans espaces autour, vides si non remplis), ou null si annulé.
export const formDialog = (
  title: string,
  fields: DialogField[],
  { message, confirmLabel = 'Valider' } = {} as {
    message?: string
    confirmLabel?: string
  },
) => open({ title, message, fields, confirmLabel })

export const confirmDialog = (
  title: string,
  { message, confirmLabel = 'Confirmer', danger = false } = {} as {
    message?: string
    confirmLabel?: string
    danger?: boolean
  },
) =>
  open({ title, message, confirmLabel, danger, fields: [] }).then(
    (values) => values !== null,
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
      // Valeur proposée présélectionnée : la frappe la remplace.
      ref.current?.querySelector('input')?.select()
    }
  }, [request])

  if (!request) {
    return null
  }

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    settle(
      Object.fromEntries(
        request.fields.map((f) => [
          f.name,
          String(data.get(f.name) ?? '').trim(),
        ]),
      ),
    )
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
        {request.fields.map((f) => (
          <label key={f.name} className="flex flex-col gap-1">
            {f.label && (
              <span className="text-xs text-ink-soft">{f.label}</span>
            )}
            <input
              name={f.name}
              type={f.type ?? 'text'}
              // Lien : http(s) seulement, comme le back.
              pattern={f.type === 'url' ? 'https?://.+' : undefined}
              required={f.required}
              autoComplete="off"
              placeholder={f.placeholder}
              defaultValue={f.defaultValue}
              maxLength={f.maxLength ?? 120}
              className={fieldClass}
            />
          </label>
        ))}
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
