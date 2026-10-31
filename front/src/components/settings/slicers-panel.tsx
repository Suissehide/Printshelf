import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button.tsx'
import { useModels } from '@/queries/useLibrary.ts'
import {
  usePreferencesMutations,
  usePreferencesQuery,
} from '@/queries/useOrganizer.ts'
import { useSlicersQuery, useSystemActions } from '@/queries/useSystem.ts'
import type { SlicerPreferences } from '@/types/library.ts'
import { fieldClass, Panel } from './panel.tsx'

const DEFAULT_PREFS: SlicerPreferences = { defaultSlicerId: null, tagRules: [] }

// Slicers détectés, slicer par défaut et règles « tag → slicer » (synchronisés entre ordinateurs).
export const SlicersPanel = () => {
  const { data: slicers = [] } = useSlicersQuery()
  const { refreshSlicers } = useSystemActions()
  const prefs = usePreferencesQuery().data?.slicers ?? DEFAULT_PREFS
  const { setSlicers } = usePreferencesMutations()
  const { models } = useModels()
  const tags = useMemo(
    () => [...new Set(models.flatMap((m) => m.tags))].sort(),
    [models],
  )
  const [tag, setTag] = useState('')
  const [ruleSlicer, setRuleSlicer] = useState('')

  const save = (patch: Partial<SlicerPreferences>) =>
    setSlicers.mutate({ ...prefs, ...patch })
  const addRule = () => {
    const value = tag.trim().toLowerCase()
    const target = ruleSlicer || slicers[0]?.id
    if (value && target) {
      save({
        tagRules: [
          ...prefs.tagRules.filter((r) => r.tag !== value),
          { tag: value, slicerId: target },
        ],
      })
      setTag('')
    }
  }
  const nameOf = (id: string) =>
    slicers.find((s) => s.id === id)?.name ?? `${id} (absent ici)`

  return (
    <Panel
      title="Slicers"
      description="Où partent les modèles. Une règle par tag l'emporte sur le slicer par défaut : par exemple « résine » → Lychee. Ces choix suivent vos ordinateurs."
    >
      {slicers.length === 0 ? (
        <p className="text-ink-mute">
          Aucun slicer trouvé : les modèles s'ouvriront avec l'application par
          défaut.
        </p>
      ) : (
        <label className="flex items-center gap-3">
          <span className="w-32 shrink-0 text-ink-soft">Par défaut</span>
          <select
            value={prefs.defaultSlicerId ?? ''}
            onChange={(e) => save({ defaultSlicerId: e.target.value || null })}
            className={`${fieldClass} flex-1`}
          >
            <option value="">Premier détecté ({slicers[0].name})</option>
            {slicers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {prefs.tagRules.map((rule) => (
        <div
          key={rule.tag}
          className="flex items-center gap-3 rounded-lg border border-line bg-surface py-1.5 pr-1.5 pl-3"
        >
          <span className="rounded-md bg-raised px-2 py-0.5 text-xs">
            {rule.tag}
          </span>
          <span className="text-ink-mute">→</span>
          <span className="flex-1">{nameOf(rule.slicerId)}</span>
          <Button
            size="icon"
            variant="danger"
            aria-label={`Supprimer la règle ${rule.tag}`}
            onClick={() =>
              save({
                tagRules: prefs.tagRules.filter((r) => r.tag !== rule.tag),
              })
            }
          >
            <Trash2 />
          </Button>
        </div>
      ))}

      {slicers.length > 0 && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            addRule()
          }}
        >
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            list="rule-tags"
            placeholder="Tag, ex. résine"
            className={`${fieldClass} w-40`}
          />
          <datalist id="rule-tags">
            {tags.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <select
            value={ruleSlicer}
            onChange={(e) => setRuleSlicer(e.target.value)}
            aria-label="Slicer de la règle"
            className={`${fieldClass} flex-1`}
          >
            {slicers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={!tag.trim()}>
            <Plus /> Règle
          </Button>
        </form>
      )}

      <div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => refreshSlicers.mutate()}
        >
          <RefreshCw
            className={refreshSlicers.isPending ? 'animate-spin' : ''}
          />{' '}
          Rechercher les slicers installés
        </Button>
      </div>
    </Panel>
  )
}
