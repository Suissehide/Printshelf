import { FolderOpen } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { Button } from '@/components/ui/button.tsx'
import { toastError } from '@/hooks/useToast.ts'
import { pickFolder, useCapabilities } from '@/queries/useSystem.ts'

// Champ de chemin + bouton « Parcourir » (sélecteur natif en mode bureau).
export const FolderField = ({
  placeholder,
  submitLabel,
  onSubmit,
}: {
  placeholder: string
  submitLabel: string
  onSubmit: (path: string) => void
}) => {
  const { desktop } = useCapabilities()
  const [value, setValue] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (value.trim()) {
      onSubmit(value.trim())
      setValue('')
    }
  }
  const browse = async () => {
    try {
      const path = await pickFolder()
      if (path) {
        onSubmit(path)
      }
    } catch (error) {
      toastError(error)
    }
  }
  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-8.5 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 font-mono text-xs outline-none placeholder:font-sans placeholder:text-ink-mute focus:border-accent/60"
      />
      {desktop && (
        <Button onClick={browse}>
          <FolderOpen /> Parcourir…
        </Button>
      )}
      <Button type="submit" variant="primary" disabled={!value.trim()}>
        {submitLabel}
      </Button>
    </form>
  )
}
