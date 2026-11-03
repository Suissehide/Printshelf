import { X } from 'lucide-react'
import { type KeyboardEvent, useState } from 'react'

import { Button } from '@/components/ui/button.tsx'

type TagInputProps = {
  tags: string[]
  suggestions: string[]
  // Tags proposés en un clic sous le champ (tirés des dossiers et du nom du fichier).
  proposed?: string[]
  onChange: (tags: string[]) => void
}

// Saisie de tags : Entrée ou virgule pour valider, Retour arrière pour retirer le dernier.
export const TagInput = ({
  tags,
  suggestions,
  proposed = [],
  onChange,
}: TagInputProps) => {
  const [draft, setDraft] = useState('')
  const listId = 'tag-suggestions'

  const commit = () => {
    const value = draft.trim().toLowerCase().replace(/,$/, '')
    if (value && !tags.includes(value)) {
      onChange([...tags, value])
    }
    setDraft('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Backspace' && !draft && tags.length) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5 focus-within:border-accent/60">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-raised py-0.5 pr-1 pl-2 text-xs text-ink"
          >
            {tag}
            <Button
              size="xs"
              variant="ghost"
              aria-label={`Retirer le tag ${tag}`}
              className="size-4 [&_svg]:size-3"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
            >
              <X />
            </Button>
          </span>
        ))}
        <input
          value={draft}
          list={listId}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          placeholder={tags.length ? '' : 'Ajouter un tag…'}
          className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-mute"
        />
        <datalist id={listId}>
          {suggestions
            .filter((s) => !tags.includes(s))
            .map((s) => (
              <option key={s} value={s} />
            ))}
        </datalist>
      </div>
      {proposed.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-ink-mute">Suggestions :</span>
          {proposed.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onChange([...tags, tag])}
              className="rounded-md border border-dashed border-line-strong px-2 py-0.5 text-ink-soft transition-colors hover:border-accent/60 hover:text-ink"
            >
              + {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
