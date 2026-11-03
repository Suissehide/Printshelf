import { createFileRoute, Link } from '@tanstack/react-router'
import { Archive, Copy, CopyCheck, FolderSearch, Shapes } from 'lucide-react'
import { useMemo } from 'react'

import { Thumbnail } from '@/components/library/thumbnail.tsx'
import { Button } from '@/components/ui/button.tsx'
import { EmptyState } from '@/components/ui/empty-state.tsx'
import { PageHeader } from '@/components/ui/page-header.tsx'
import {
  type DuplicateGroup,
  findDuplicates,
} from '@/libs/library/duplicates.ts'
import { useModels, useSourcesQuery } from '@/queries/useLibrary.ts'
import { useCapabilities, useSystemActions } from '@/queries/useSystem.ts'
import type { Model } from '@/types/library.ts'
import { cn } from '@/utils/cn.ts'
import {
  formatDate,
  formatSize,
  plural,
  sourceRelativeDir,
} from '@/utils/format.ts'

export const Route = createFileRoute('/doublons')({ component: DuplicatesPage })

const Row = ({
  model,
  badge,
  tone,
}: {
  model: Model
  badge: string
  tone: 'keep' | 'copy' | 'maybe'
}) => {
  const { data: sources = [] } = useSourcesQuery()
  const { reveal } = useSystemActions()
  const { desktop } = useCapabilities()
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <Thumbnail
        hash={model.hash}
        path={model.path}
        ext={model.ext}
        className="size-11 shrink-0 rounded-lg"
      />
      <div className="min-w-0 flex-1">
        <Link
          to="/modele"
          search={{ path: model.path }}
          className="block truncate font-medium hover:text-accent"
        >
          {model.name}
        </Link>
        <p className="truncate text-xs text-ink-mute" title={model.path}>
          {model.archive && <Archive className="mr-1 inline size-3" />}
          {sourceRelativeDir(model.dir, sources)}
        </p>
      </div>
      <span className="hidden font-mono text-[11px] text-ink-mute tabular-nums sm:block">
        {formatSize(model.size)} · {formatDate(model.mtime)}
      </span>
      <span
        className={cn(
          'rounded-md px-2 py-0.5 text-[11px] font-medium',
          tone === 'keep' && 'bg-ok/10 text-ok',
          tone === 'copy' && 'bg-warn/10 text-warn',
          tone === 'maybe' && 'bg-info/10 text-info',
        )}
      >
        {badge}
      </span>
      {desktop && (
        <Button
          size="icon"
          variant="ghost"
          aria-label="Afficher dans le dossier"
          onClick={() => reveal.mutate(model.path)}
        >
          <FolderSearch />
        </Button>
      )}
    </li>
  )
}

const BADGES: Record<DuplicateGroup['kind'], string> = {
  exact: 'Copie exacte',
  geometry: 'Même géométrie',
  probable: 'Doublon probable',
}

const Group = ({ group }: { group: DuplicateGroup }) => (
  <section className="overflow-hidden rounded-(--radius-card) border border-line bg-surface">
    <ul className="divide-y divide-line">
      <Row model={group.keep} badge="À garder" tone="keep" />
      {group.others.map((m) => (
        <Row
          key={m.path}
          model={m}
          badge={BADGES[group.kind]}
          tone={group.kind === 'exact' ? 'copy' : 'maybe'}
        />
      ))}
    </ul>
  </section>
)

function DuplicatesPage() {
  const { models } = useModels()
  const groups = useMemo(() => findDuplicates(models), [models])
  const exact = groups.filter((g) => g.kind === 'exact')
  const geometry = groups.filter((g) => g.kind === 'geometry')
  const probable = groups.filter((g) => g.kind === 'probable')
  const reclaimable = exact.reduce((s, g) => s + g.reclaimable, 0)

  return (
    <div className="h-full overflow-y-auto">
      <PageHeader
        title="Doublons"
        subtitle={
          exact.length
            ? `${plural(exact.length, 'groupe')} de copies exactes · ${formatSize(reclaimable)} récupérables`
            : 'Fichiers au contenu identique ou au nom très proche.'
        }
      />
      {groups.length === 0 ? (
        <EmptyState icon={<CopyCheck />} title="Aucun doublon">
          Chaque modèle de votre bibliothèque est unique.
        </EmptyState>
      ) : (
        <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-6">
          {exact.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 font-semibold">
                <Copy className="size-4 text-warn" /> Copies exactes
                <span className="font-normal text-ink-mute">
                  — même contenu, octet pour octet
                </span>
              </h2>
              {exact.map((g) => (
                <Group key={g.key} group={g} />
              ))}
            </div>
          )}
          {geometry.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 font-semibold">
                <Shapes className="size-4 text-info" /> Même modèle
                <span className="font-normal text-ink-mute">
                  — même forme dans des fichiers différents (STL et 3MF…)
                </span>
              </h2>
              {geometry.map((g) => (
                <Group key={g.key} group={g} />
              ))}
            </div>
          )}
          {probable.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 font-semibold">
                À vérifier{' '}
                <span className="font-normal text-ink-mute">
                  — même nom, contenu différent (versions ?)
                </span>
              </h2>
              {probable.map((g) => (
                <Group key={g.key} group={g} />
              ))}
            </div>
          )}
          <p className="text-xs text-ink-mute">
            Printshelf ne supprime jamais rien : supprimez les copies depuis le
            Finder ou l'Explorateur, puis relancez un scan.
          </p>
        </div>
      )}
    </div>
  )
}
