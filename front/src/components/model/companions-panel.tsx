import { FileText, ScrollText } from 'lucide-react'

import { LibraryApi } from '@/api/library.api.ts'
import { useCompanionsQuery } from '@/queries/useLibrary.ts'
import { formatSize } from '@/utils/format.ts'

// Rendus, notices et readme du pack, ouverts dans un nouvel onglet (servis par le back,
// y compris depuis une archive).
export const CompanionsPanel = ({ path }: { path: string }) => {
  const { data: companions = [] } = useCompanionsQuery(path)
  if (!companions.length) {
    return null
  }
  const images = companions.filter((c) => c.kind === 'image')
  const documents = companions.filter((c) => c.kind !== 'image')

  return (
    <div className="flex flex-col gap-2">
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {images.map((c) => (
            <a
              key={c.name}
              href={LibraryApi.companionUrl(path, c.name)}
              target="_blank"
              rel="noreferrer"
              title={c.name}
              className="aspect-square overflow-hidden rounded-lg border border-line bg-surface hover:border-accent/60"
            >
              <img
                src={LibraryApi.companionUrl(path, c.name)}
                alt={c.name}
                loading="lazy"
                className="size-full object-cover"
              />
            </a>
          ))}
        </div>
      )}
      {documents.map((c) => (
        <a
          key={c.name}
          href={LibraryApi.companionUrl(path, c.name)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-2 text-xs hover:border-line-strong"
        >
          {c.kind === 'pdf' ? (
            <FileText className="size-4 text-danger" />
          ) : (
            <ScrollText className="size-4 text-info" />
          )}
          <span className="min-w-0 flex-1 truncate font-mono" title={c.name}>
            {c.name}
          </span>
          <span className="text-ink-mute">{formatSize(c.size)}</span>
        </a>
      ))}
    </div>
  )
}
