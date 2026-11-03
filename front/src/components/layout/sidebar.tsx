import { Link, useRouterState } from '@tanstack/react-router'
import {
  Archive,
  Box,
  Copy,
  FolderOpen,
  Inbox,
  ListChecks,
  Loader2,
  Plus,
  Send,
  Settings,
  Star,
  Tag,
} from 'lucide-react'
import { type ReactNode, useMemo } from 'react'

import { promptDialog } from '@/components/ui/dialog.tsx'
import { findDuplicates } from '@/libs/library/duplicates.ts'
import type { LibrarySearch } from '@/libs/library/filters.ts'
import {
  useModels,
  useScanQuery,
  useSourcesQuery,
} from '@/queries/useLibrary.ts'
import {
  useCollectionMutations,
  useCollectionsQuery,
  useQueueQuery,
} from '@/queries/useOrganizer.ts'
import { useSyncQuery } from '@/queries/useSystem.ts'
import { cn } from '@/utils/cn.ts'
import { baseName } from '@/utils/format.ts'

const COLLECTION_COLORS = [
  '#ff8a3d',
  '#60a5fa',
  '#4ade80',
  '#f472b6',
  '#facc15',
  '#a78bfa',
  '#2dd4bf',
]

const NavItem = ({
  to,
  search,
  icon,
  label,
  count,
  active,
}: {
  to: string
  search?: LibrarySearch
  icon: ReactNode
  label: string
  count?: number
  active: boolean
}) => (
  <Link
    to={to}
    search={search}
    className={cn(
      'group flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-ink-soft transition-colors hover:bg-raised hover:text-ink [&_svg]:size-4 [&_svg]:shrink-0',
      active && 'bg-raised text-ink',
    )}
  >
    <span
      className={cn(
        'text-ink-mute group-hover:text-ink-soft',
        active && 'text-accent group-hover:text-accent',
      )}
    >
      {icon}
    </span>
    <span className="flex-1 truncate">{label}</span>
    {count !== undefined && (
      <span className="font-mono text-[11px] text-ink-mute tabular-nums">
        {count}
      </span>
    )}
  </Link>
)

const Section = ({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) => (
  <section className="mt-5">
    <div className="mb-1 flex h-6 items-center justify-between px-2.5">
      <h3 className="text-[10.5px] font-semibold tracking-[0.12em] text-ink-mute uppercase">
        {title}
      </h3>
      {action}
    </div>
    {children}
  </section>
)

export const Sidebar = () => {
  const location = useRouterState({ select: (s) => s.location })
  const search = location.search as LibrarySearch
  const onLibrary = location.pathname === '/'
  const { models } = useModels()
  const { data: collections = [] } = useCollectionsQuery()
  const { data: queue = [] } = useQueueQuery()
  const { data: sources = [] } = useSourcesQuery()
  const { data: scan } = useScanQuery()
  const { data: sync } = useSyncQuery()
  const { create } = useCollectionMutations()

  const counts = useMemo(() => {
    const tags = new Map<string, number>()
    for (const m of models) {
      for (const t of m.tags) {
        tags.set(t, (tags.get(t) ?? 0) + 1)
      }
    }
    return {
      favorites: models.filter((m) => m.favorite).length,
      unsorted: models.filter((m) => !m.collectionIds.length).length,
      archives: models.filter((m) => m.archive).length,
      sent: models.filter((m) => m.sentAt !== null).length,
      duplicates: findDuplicates(models).filter((g) => g.kind === 'exact')
        .length,
      tags: [...tags].sort(([a], [b]) => a.localeCompare(b)),
    }
  }, [models])

  const onlyView = (view?: LibrarySearch['view']) =>
    onLibrary &&
    search.view === view &&
    !search.collection &&
    !search.tag &&
    search.source === undefined

  const newCollection = async () => {
    const name = await promptDialog('Nouvelle collection', {
      placeholder: 'Nom de la collection',
      confirmLabel: 'Créer',
    })
    if (name) {
      create.mutate({
        name,
        color: COLLECTION_COLORS[collections.length % COLLECTION_COLORS.length],
      })
    }
  }

  return (
    <aside className="flex h-full w-62 shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <img src="/favicon.svg" alt="" className="size-7" />
        <span className="text-[15px] font-semibold tracking-tight">
          Printshelf
        </span>
        {sync?.folder && (
          <span
            title={`Synchronisé via ${sync.folder}`}
            className={cn(
              'ml-auto size-2 rounded-full',
              sync.error ? 'bg-danger' : 'bg-ok',
            )}
          />
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        <NavItem
          to="/"
          icon={<Box />}
          label="Bibliothèque"
          count={models.length}
          active={onlyView(undefined)}
        />
        <NavItem
          to="/"
          search={{ view: 'favorites' }}
          icon={<Star />}
          label="Favoris"
          count={counts.favorites}
          active={onlyView('favorites')}
        />
        <NavItem
          to="/"
          search={{ view: 'unsorted' }}
          icon={<Inbox />}
          label="Sans collection"
          count={counts.unsorted}
          active={onlyView('unsorted')}
        />
        <NavItem
          to="/"
          search={{ view: 'archives' }}
          icon={<Archive />}
          label="Dans des archives"
          count={counts.archives}
          active={onlyView('archives')}
        />
        <NavItem
          to="/"
          search={{ view: 'sent' }}
          icon={<Send />}
          label="Envoyés au slicer"
          count={counts.sent}
          active={onlyView('sent')}
        />
        <NavItem
          to="/doublons"
          icon={<Copy />}
          label="Doublons"
          count={counts.duplicates}
          active={location.pathname === '/doublons'}
        />
        <NavItem
          to="/file"
          icon={<ListChecks />}
          label="File d'impression"
          count={queue.filter((q) => q.status !== 'DONE').length}
          active={location.pathname === '/file'}
        />

        <Section
          title="Collections"
          action={
            <button
              type="button"
              onClick={newCollection}
              aria-label="Nouvelle collection"
              className="rounded p-0.5 text-ink-mute hover:text-accent"
            >
              <Plus className="size-3.5" />
            </button>
          }
        >
          {collections.length === 0 && (
            <p className="px-2.5 py-1 text-xs text-ink-mute">
              Regroupez des modèles sans les déplacer.
            </p>
          )}
          {collections.map((c) => (
            <NavItem
              key={c.id}
              to="/"
              search={{ collection: c.id }}
              icon={
                <span
                  className="block size-2.5 rounded-[4px]"
                  style={{ background: c.color }}
                />
              }
              label={c.name}
              count={c.hashes.length}
              active={onLibrary && search.collection === c.id}
            />
          ))}
        </Section>

        {counts.tags.length > 0 && (
          <Section title="Tags">
            <div className="flex flex-wrap gap-1 px-2">
              {counts.tags.map(([tag, n]) => (
                <Link
                  key={tag}
                  to="/"
                  search={onLibrary && search.tag === tag ? {} : { tag }}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-xs text-ink-soft hover:border-line-strong hover:text-ink',
                    onLibrary &&
                      search.tag === tag &&
                      'border-accent/50 bg-accent-soft text-accent',
                  )}
                >
                  <Tag className="size-3" />
                  {tag}
                  <span className="text-ink-mute">{n}</span>
                </Link>
              ))}
            </div>
          </Section>
        )}

        <Section title="Sources">
          {sources.map((s) => (
            <NavItem
              key={s.id}
              to="/"
              search={{ source: s.id }}
              icon={<FolderOpen />}
              label={baseName(s.path)}
              count={models.filter((m) => m.source_id === s.id).length}
              active={onLibrary && search.source === s.id}
            />
          ))}
        </Section>
      </nav>

      <div className="border-t border-line p-2">
        {scan?.running && (
          <div className="mb-1 flex items-center gap-2 rounded-lg bg-accent-soft px-2.5 py-2 text-xs text-accent">
            <Loader2 className="size-3.5 shrink-0 animate-spin" />
            <span className="truncate" title={scan.current ?? undefined}>
              Scan… {scan.processed.toLocaleString('fr-FR')} fichiers
            </span>
          </div>
        )}
        <NavItem
          to="/reglages"
          icon={<Settings />}
          label="Réglages"
          active={location.pathname === '/reglages'}
        />
      </div>
    </aside>
  )
}
