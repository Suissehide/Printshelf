import { Plus, Printer as PrinterIcon, Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { Button } from '@/components/ui/button.tsx'
import { PRINTER_PRESETS } from '@/libs/library/slicer.ts'
import {
  usePreferencesMutations,
  usePreferencesQuery,
} from '@/queries/useOrganizer.ts'
import { fieldClass, Panel } from './panel.tsx'

const EMPTY = { name: '', x: '', y: '', z: '' }

// Imprimantes et volume d'impression : servent au badge « Trop grand » et au filtre
// « Tient sur… » de la bibliothèque. Synchronisées entre ordinateurs.
export const PrintersPanel = () => {
  const printers = usePreferencesQuery().data?.printers ?? []
  const { setPrinters } = usePreferencesMutations()
  const [draft, setDraft] = useState(EMPTY)

  const applyPreset = (name: string) => {
    const preset = PRINTER_PRESETS.find((p) => p.name === name)
    if (preset) {
      setDraft({
        name: preset.name,
        x: String(preset.x),
        y: String(preset.y),
        z: String(preset.z),
      })
    }
  }
  const sizes = [draft.x, draft.y, draft.z].map(Number)
  const valid = draft.name.trim() && sizes.every((v) => v > 0 && v <= 5000)
  const add = (e: FormEvent) => {
    e.preventDefault()
    if (valid) {
      const [x, y, z] = sizes
      setPrinters.mutate([
        ...printers,
        { id: crypto.randomUUID(), name: draft.name.trim(), x, y, z },
      ])
      setDraft(EMPTY)
    }
  }

  return (
    <Panel
      title="Imprimantes"
      description="Le volume d'impression de chaque machine. Un modèle trop grand pour toutes est signalé, et la bibliothèque peut n'afficher que ce qui tient sur l'une d'elles (un quart de tour sur le plateau est permis)."
    >
      {printers.map((p) => (
        <div
          key={p.id}
          className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2"
        >
          <PrinterIcon className="size-4 shrink-0 text-accent" />
          <span className="flex-1">{p.name}</span>
          <span className="font-mono text-xs text-ink-mute">
            {p.x} × {p.y} × {p.z} mm
          </span>
          <Button
            size="icon"
            variant="danger"
            aria-label={`Retirer ${p.name}`}
            onClick={() =>
              setPrinters.mutate(printers.filter((other) => other.id !== p.id))
            }
          >
            <Trash2 />
          </Button>
        </div>
      ))}

      <form onSubmit={add} className="flex flex-col gap-2">
        <select
          value=""
          onChange={(e) => applyPreset(e.target.value)}
          aria-label="Modèle d'imprimante"
          className={fieldClass}
        >
          <option value="">Choisir un modèle courant…</option>
          {PRINTER_PRESETS.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name} — {p.x} × {p.y} × {p.z}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Nom, ex. A1 du salon"
            className={`${fieldClass} min-w-40 flex-1`}
          />
          {(['x', 'y', 'z'] as const).map((axis) => (
            <input
              key={axis}
              type="number"
              min={1}
              max={5000}
              value={draft[axis]}
              onChange={(e) => setDraft({ ...draft, [axis]: e.target.value })}
              placeholder={axis.toUpperCase()}
              aria-label={`${axis.toUpperCase()} en mm`}
              className={`${fieldClass} w-20 font-mono`}
            />
          ))}
          <span className="text-xs text-ink-mute">mm</span>
          <Button type="submit" variant="primary" disabled={!valid}>
            <Plus /> Ajouter
          </Button>
        </div>
      </form>
    </Panel>
  )
}
