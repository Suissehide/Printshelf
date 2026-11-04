import { Archive, Folder } from 'lucide-react'

import type { FolderEntry } from '@/libs/library/folders.ts'
import { cn } from '@/utils/cn.ts'
import { plural } from '@/utils/format.ts'
import { Thumbnail } from './thumbnail.tsx'

// Un dossier (ou une archive) dans la grille : mosaïque des premières miniatures, puis son nom.
// Même gabarit qu'une carte de modèle pour garder des rangées régulières.
export const FolderCard = ({
  folder,
  onOpen,
}: {
  folder: FolderEntry
  onOpen: () => void
}) => {
  const Icon = folder.archive ? Archive : Folder
  return (
    <button
      type="button"
      onClick={onOpen}
      title={folder.path}
      className="group flex h-full flex-col overflow-hidden rounded-(--radius-card) border border-line bg-surface text-left transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-line-strong"
    >
      <div
        className={cn(
          'thumb-stage grid aspect-square w-full gap-px',
          folder.samples.length > 1 && 'grid-cols-2 grid-rows-2',
        )}
      >
        {folder.samples.map((m) => (
          <Thumbnail
            key={m.path}
            hash={m.hash}
            path={m.path}
            ext={m.ext}
            className="size-full bg-transparent"
          />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 border-t border-line px-3 py-2.5">
        <p className="flex items-center gap-1.5 font-medium text-ink">
          <Icon className="size-4 shrink-0 text-accent" />
          <span className="truncate">{folder.name}</span>
        </p>
        <p className="text-[11.5px] text-ink-mute">
          {plural(folder.count, 'modèle')}
        </p>
      </div>
    </button>
  )
}
