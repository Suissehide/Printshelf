import { X } from 'lucide-react'
import { type KeyboardEvent, useState } from 'react'

import { Button } from '@/components/ui/button.tsx'

type TagInputProps = {
  tags: string[]
  suggestions: string[]
  onChange: (tags: string[]) => void
}

// Saisie de tags : Entrée ou virgule pour valider, Retour arrière pour retirer le dernier.
export const TagInput = ({ tags, suggestions, onChange }: TagInputProps) => {
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
  )
}
