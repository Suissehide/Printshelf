import {
  Archive,
  Copy,
  Download,
  ExternalLink,
  ListPlus,
  Maximize2,
  Star,
} from 'lucide-react'
import type { DragEvent, MouseEvent } from 'react'

import type { Model } from '@/types/library.ts'
import { cn } from '@/utils/cn.ts'
import { formatSize } from '@/utils/format.ts'
import { Thumbnail } from './thumbnail.tsx'

type ModelCardProps = {
  model: Model
  selected: boolean
  // Une sélection est en cours : un clic sur la carte coche ou décoche au lieu d'ouvrir.
  selecting: boolean
  desktop: boolean
  // Mesuré et trop grand pour toutes les imprimantes déclarées.
  oversized: boolean
  onOpen: () => void
  onSelect: (event: MouseEvent) => void
  onDragStart: (event: DragEvent) => void
  onToggleFavorite: () => void
  onQueue: () => void
  onSlicer: () => void
}

const Action = ({
  label,
  onClick,
  children,
  active,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  active?: boolean
}) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    onClick={(e) => {
      e.stopPropagation()
      onClick()
    }}
    className={cn(
      'grid size-7 place-items-center rounded-lg bg-canvas/80 text-ink-soft backdrop-blur transition-colors hover:bg-canvas hover:text-ink [&_svg]:size-3.5',
      active && 'text-accent hover:text-accent',
    )}
  >
    {children}
  </button>
)

export const ModelCard = ({
  model,
  selected,
  selecting,
  desktop,
  oversized,
  onOpen,
  onSelect,
  onDragStart,
  onToggleFavorite,
  onQueue,
  onSlicer,
}: ModelCardProps) => (
  // biome-ignore lint/a11y/useSemanticElements: la carte contient des boutons, elle ne peut pas être elle-même un <button>
  <div
    role="button"
    tabIndex={0}
    aria-pressed={selected}
    draggable
    onDragStart={onDragStart}
    onClick={(e) =>
      selecting || e.metaKey || e.ctrlKey || e.shiftKey ? onSelect(e) : onOpen()
    }
    onKeyDown={(e) => e.key === 'Enter' && onOpen()}
    className={cn(
      'group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-(--radius-card) border border-line bg-surface transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-line-strong',
      selected && 'border-accent ring-1 ring-accent hover:border-accent',
    )}
  >
    <Thumbnail
      hash={model.hash}
      path={model.path}
      ext={model.ext}
      className="aspect-square w-full"
    />

    <div className="absolute top-2 left-2 flex gap-1">
      {/* Case à cocher : au survol, puis toujours visible pendant une sélection. */}
      <label
        title="Sélectionner (Maj-clic : toute une plage)"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className={cn(
          'grid size-6 cursor-pointer place-items-center rounded-md bg-canvas/80 backdrop-blur transition-opacity',
          selecting || selected
            ? 'opacity-100'
            : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100',
        )}
      >
        <input
          type="checkbox"
          checked={selected}
          readOnly
          aria-label={`Sélectionner ${model.name}`}
          onClick={(e) => {
            e.stopPropagation()
            onSelect(e)
          }}
          className="size-3.5 cursor-pointer accent-accent"
        />
      </label>
      {model.favorite && (
        <span className="grid size-6 place-items-center rounded-md bg-canvas/80 text-accent backdrop-blur">
          <Star className="size-3.5 fill-current" />
        </span>
      )}
      {model.copies > 1 && (
        <span
          title={`${model.copies} copies identiques`}
          className="flex h-6 items-center gap-1 rounded-md bg-canvas/80 px-1.5 font-mono text-[11px] text-warn backdrop-blur"
        >
          <Copy className="size-3" />
          {model.copies}
        </span>
      )}
      {oversized && model.dims && (
        <span
          title={`Trop grand pour vos imprimantes : ${model.dims.x} × ${model.dims.y} × ${model.dims.z} mm`}
          className="flex h-6 items-center gap-1 rounded-md bg-canvas/80 px-1.5 text-[11px] text-danger backdrop-blur"
        >
          <Maximize2 className="size-3" /> Trop grand
        </span>
      )}
    </div>

    <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
      <Action
        label={model.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        onClick={onToggleFavorite}
        active={model.favorite}
      >
        <Star className={cn(model.favorite && 'fill-current')} />
      </Action>
      <Action label="Ajouter à la file d'impression" onClick={onQueue}>
        <ListPlus />
      </Action>
      <Action
        label={desktop ? 'Ouvrir dans le slicer' : 'Télécharger'}
        onClick={onSlicer}
      >
        {desktop ? <ExternalLink /> : <Download />}
      </Action>
    </div>

    <div className="flex min-w-0 flex-1 flex-col gap-1 border-t border-line px-3 py-2.5">
      <p className="truncate font-medium text-ink" title={model.name}>
        {model.name.replace(/\.[^.]+$/, '')}
      </p>
      <div className="flex items-center gap-2 text-[11.5px] text-ink-mute">
        <span className="rounded bg-raised px-1.5 py-px font-mono text-[10px] font-medium tracking-wide text-ink-soft uppercase">
          {model.ext}
        </span>
        {model.archive && (
          <Archive className="size-3.5" aria-label="Dans une archive" />
        )}
        <span className="ml-auto font-mono tabular-nums">
          {formatSize(model.size)}
        </span>
      </div>
    </div>
  </div>
)
