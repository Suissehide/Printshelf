import { useNavigate } from '@tanstack/react-router'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  type DragEvent,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from 'react'

import { MODEL_HASHES_DRAG_TYPE } from '@/constants/drag.ts'
import { useOpenInSlicer } from '@/hooks/useOpenInSlicer.ts'
import { fitsOn } from '@/libs/library/slicer.ts'
import {
  useMetaMutation,
  usePreferencesQuery,
  useQueueMutations,
} from '@/queries/useOrganizer.ts'
import type { Model } from '@/types/library.ts'
import { ModelCard } from './model-card.tsx'

const GAP = 14
const FOOTER = 62 // hauteur du bandeau nom/format sous la miniature

type ModelGridProps = {
  models: Model[]
  cardSize: number
  selection: Set<string>
  onSelectionChange: (selection: Set<string>) => void
}

// Grille virtualisée : seules les rangées visibles existent dans le DOM, ce qui garde le défilement
// fluide sur des bibliothèques de plusieurs dizaines de milliers de modèles.
export const ModelGrid = ({
  models,
  cardSize,
  selection,
  onSelectionChange,
}: ModelGridProps) => {
  const navigate = useNavigate()
  const parentRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const lastClicked = useRef<number | null>(null)
  const favorite = useMetaMutation()
  const queue = useQueueMutations()
  const { open, desktop } = useOpenInSlicer()
  const { data: prefs } = usePreferencesQuery()
  const printers = prefs?.printers ?? []
  // Mesuré, et trop grand pour TOUTES les imprimantes déclarées.
  const oversized = (m: Model) =>
    printers.length > 0 &&
    m.dims !== null &&
    !printers.some((p) => m.dims && fitsOn(m.dims, p))

  useEffect(() => {
    const el = parentRef.current
    if (!el) {
      return
    }
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const inner = Math.max(0, width - 48)
  const columns = Math.max(1, Math.floor((inner + GAP) / (cardSize + GAP)))
  const cardWidth = (inner - GAP * (columns - 1)) / columns
  const rowCount = Math.ceil(models.length / columns)

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => cardWidth + FOOTER + GAP,
    overscan: 3,
  })

  // Changer la taille des cartes change la hauteur des rangées : on remesure.
  useEffect(() => {
    if (cardWidth > 0) {
      virtualizer.measure()
    }
  }, [virtualizer, cardWidth])

  const select = (index: number, event: MouseEvent) => {
    const next = new Set(selection)
    if (event.shiftKey && lastClicked.current !== null) {
      const [from, to] = [lastClicked.current, index].sort((a, b) => a - b)
      for (const m of models.slice(from, to + 1)) {
        next.add(m.path)
      }
    } else if (next.has(models[index].path)) {
      next.delete(models[index].path)
    } else {
      next.add(models[index].path)
    }
    lastClicked.current = index
    onSelectionChange(next)
  }

  // Glisser une carte sélectionnée emporte toute la sélection (visible), sinon la carte seule.
  const dragStart = (model: Model, event: DragEvent) => {
    const dragged = selection.has(model.path)
      ? models.filter((m) => selection.has(m.path))
      : [model]
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData(
      MODEL_HASHES_DRAG_TYPE,
      JSON.stringify([...new Set(dragged.map((m) => m.hash))]),
    )
  }

  return (
    <div ref={parentRef} className="h-full overflow-y-auto">
      <div
        className="relative mx-6 my-5"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((row) => (
          <div
            key={row.key}
            className="absolute inset-x-0 grid"
            style={{
              top: row.start,
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gap: GAP,
            }}
          >
            {models
              .slice(row.index * columns, row.index * columns + columns)
              .map((model, i) => {
                const index = row.index * columns + i
                return (
                  <ModelCard
                    key={model.path}
                    model={model}
                    selected={selection.has(model.path)}
                    selecting={selection.size > 0}
                    onOpen={() =>
                      navigate({ to: '/modele', search: { path: model.path } })
                    }
                    onSelect={(e) => select(index, e)}
                    onDragStart={(e) => dragStart(model, e)}
                    onToggleFavorite={() =>
                      favorite.mutate({
                        hash: model.hash,
                        favorite: !model.favorite,
                      })
                    }
                    onQueue={() =>
                      queue.add.mutate({ hash: model.hash, name: model.name })
                    }
                    desktop={desktop}
                    oversized={oversized(model)}
                    onSlicer={() => open([model])}
                  />
                )
              })}
          </div>
        ))}
      </div>
    </div>
  )
}
