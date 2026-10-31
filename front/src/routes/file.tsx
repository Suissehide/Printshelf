import { createFileRoute, Link } from '@tanstack/react-router'
import { ClipboardCopy, ListChecks, Send, Trash2 } from 'lucide-react'
import { useMemo } from 'react'

import { Thumbnail } from '@/components/library/thumbnail.tsx'
import { Button } from '@/components/ui/button.tsx'
import { EmptyState } from '@/components/ui/empty-state.tsx'
import { PageHeader } from '@/components/ui/page-header.tsx'
import { useOpenInSlicer } from '@/hooks/useOpenInSlicer.ts'
import { toast } from '@/hooks/useToast.ts'
import { useModels, usePrintInfos } from '@/queries/useLibrary.ts'
import { useQueueMutations, useQueueQuery } from '@/queries/useOrganizer.ts'
import type { PrintInfo, QueueStatus } from '@/types/library.ts'
import { cn } from '@/utils/cn.ts'
import { formatDuration, formatGrams } from '@/utils/format.ts'

export const Route = createFileRoute('/file')({ component: QueuePage })

const STATUSES: { value: QueueStatus; label: string; className: string }[] = [
  { value: 'TODO', label: 'À imprimer', className: 'text-ink-soft' },
  { value: 'PRINTING', label: 'En cours', className: 'text-info' },
  { value: 'DONE', label: 'Imprimé', className: 'text-ok' },
  { value: 'FAILED', label: 'Échoué', className: 'text-danger' },
]

// Durée et poids d'un exemplaire, si le 3MF a été tranché (somme de ses plateaux).
const estimate = (info: PrintInfo | undefined) => {
  const sliced = info?.plates.filter((p) => p.seconds !== null) ?? []
  return sliced.length
    ? {
        seconds: sliced.reduce((s, p) => s + (p.seconds ?? 0), 0),
        grams: sliced.reduce((s, p) => s + (p.grams ?? 0), 0),
      }
    : null
}

const estimateLabel = (e: { seconds: number; grams: number }) =>
  `${formatDuration(e.seconds)} · ${formatGrams(e.grams)}`

function QueuePage() {
  const { data: queue = [] } = useQueueQuery()
  const { models } = useModels()
  const { update, remove } = useQueueMutations()
  const { open, desktop } = useOpenInSlicer()
  // Un même contenu peut être à plusieurs endroits : n'importe quelle copie fait l'affaire.
  const modelByHash = useMemo(
    () => new Map(models.map((m) => [m.hash, m])),
    [models],
  )
  const remaining = queue.filter(
    (q) => q.status === 'TODO' || q.status === 'PRINTING',
  )
  // Ce qui reste à imprimer et existe sur cet ordinateur, une fois par contenu.
  const toSlice = [
    ...new Map(
      remaining.flatMap((q) => {
        const model = modelByHash.get(q.hash)
        return model ? [[q.hash, model] as const] : []
      }),
    ).values(),
  ]
  const estimates = usePrintInfos(
    queue.map((q) => modelByHash.get(q.hash)),
  ).map(estimate)
  const remainingTotal = queue.reduce(
    (total, q, i) => {
      const e = estimates[i]
      return e && (q.status === 'TODO' || q.status === 'PRINTING')
        ? {
            seconds: total.seconds + e.seconds * q.quantity,
            grams: total.grams + e.grams * q.quantity,
          }
        : total
    },
    { seconds: 0, grams: 0 },
  )

  const copyChecklist = async () => {
    const lines = queue.map(
      (q) =>
        `- [${q.status === 'DONE' ? 'x' : ' '}] ${q.quantity} × ${q.name}${q.status === 'FAILED' ? ' (échoué)' : ''}`,
    )
    await navigator.clipboard.writeText(
      `File d'impression\n\n${lines.join('\n')}\n`,
    )
    toast('Checklist copiée dans le presse-papiers')
  }

  return (
    <div className="h-full overflow-y-auto">
      <PageHeader
        title="File d'impression"
        subtitle={`${remaining.length} à imprimer · ${queue.filter((q) => q.status === 'DONE').length} imprimé(s)${remainingTotal.seconds ? ` · reste ≈ ${estimateLabel(remainingTotal)}` : ''}`}
        actions={
          queue.length > 0 && (
            <>
              <Button onClick={copyChecklist}>
                <ClipboardCopy /> Copier la checklist
              </Button>
              {desktop && toSlice.length > 0 && (
                <Button variant="primary" onClick={() => open(toSlice)}>
                  <Send /> Envoyer{' '}
                  {toSlice.length > 1 ? `les ${toSlice.length}` : ''} au slicer
                </Button>
              )}
            </>
          )
        }
      />
      {queue.length === 0 ? (
        <EmptyState icon={<ListChecks />} title="La file est vide">
          Ajoutez des modèles depuis la bibliothèque pour préparer une série (un
          marché, des cadeaux…). La file se synchronise entre vos ordinateurs.
        </EmptyState>
      ) : (
        <ul className="mx-auto flex max-w-4xl flex-col gap-2 px-6 py-6">
          {queue.map((item, i) => {
            const model = modelByHash.get(item.hash)
            const itemEstimate = estimates[i]
            const status =
              STATUSES.find((s) => s.value === item.status) ?? STATUSES[0]
            return (
              <li
                key={item.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5 pr-3',
                  item.status === 'DONE' && 'opacity-60',
                )}
              >
                {model ? (
                  <Thumbnail
                    hash={model.hash}
                    path={model.path}
                    ext={model.ext}
                    className="size-12 shrink-0 rounded-lg"
                  />
                ) : (
                  <div className="thumb-stage size-12 shrink-0 rounded-lg" />
                )}
                <div className="min-w-0 flex-1">
                  {model ? (
                    <Link
                      to="/modele"
                      search={{ path: model.path }}
                      className="block truncate font-medium hover:text-accent"
                    >
                      {item.name}
                    </Link>
                  ) : (
                    <p className="truncate font-medium">{item.name}</p>
                  )}
                  {itemEstimate && (
                    <p className="font-mono text-[11px] text-ink-mute">
                      {estimateLabel(itemEstimate)}
                      {item.quantity > 1 && ` × ${item.quantity}`}
                    </p>
                  )}
                  {!model && (
                    <p className="text-xs text-ink-mute">
                      Fichier absent de cet ordinateur
                    </p>
                  )}
                </div>
                <label className="flex items-center gap-1.5 text-xs text-ink-mute">
                  Qté
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={item.quantity}
                    onChange={(e) =>
                      update.mutate({
                        id: item.id,
                        quantity: Math.max(1, Number(e.target.value)),
                      })
                    }
                    className="h-8 w-14 rounded-lg border border-line bg-raised px-2 text-center font-mono text-ink outline-none"
                  />
                </label>
                <select
                  aria-label="Statut"
                  value={item.status}
                  onChange={(e) =>
                    update.mutate({
                      id: item.id,
                      status: e.target.value as QueueStatus,
                    })
                  }
                  className={cn(
                    'h-8 rounded-lg border border-line bg-raised px-2 outline-none',
                    status.className,
                  )}
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <Button
                  size="icon"
                  variant="danger"
                  aria-label="Retirer de la file"
                  onClick={() => remove.mutate(item.id)}
                >
                  <Trash2 />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
