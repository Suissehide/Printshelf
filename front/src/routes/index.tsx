import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { FolderPlus, Loader2, Search, SearchX, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { ModelGrid } from '@/components/library/model-grid.tsx'
import { SelectionBar } from '@/components/library/selection-bar.tsx'
import { Button } from '@/components/ui/button.tsx'
import { EmptyState } from '@/components/ui/empty-state.tsx'
import { useOpenInSlicer } from '@/hooks/useOpenInSlicer.ts'
import {
  filterModels,
  type LibrarySearch,
  validateLibrarySearch,
} from '@/libs/library/filters.ts'
import {
  useModels,
  useScanQuery,
  useSourcesQuery,
} from '@/queries/useLibrary.ts'
import {
  useCollectionsQuery,
  usePreferencesQuery,
} from '@/queries/useOrganizer.ts'
import type { Collection, Source } from '@/types/library.ts'
import { cn } from '@/utils/cn.ts'
import { baseName, plural } from '@/utils/format.ts'

export const Route = createFileRoute('/')({
  validateSearch: validateLibrarySearch,
  component: LibraryPage,
})

const FORMATS = ['3mf', 'stl', 'obj', 'ply', 'glb']
const VIEW_TITLES: Record<NonNullable<LibrarySearch['view']>, string> = {
  sent: 'Envoyés au slicer',
  favorites: 'Favoris',
  unsorted: 'Sans collection',
  archives: 'Dans des archives',
}
const CARD_SIZE_KEY = 'printshelf.cardSize'

const readCardSize = () => {
  try {
    return Number(localStorage.getItem(CARD_SIZE_KEY)) || 200
  } catch {
    return 200
  }
}

// Titre de la vue courante : collection, tag, source ou vue prédéfinie.
const libraryTitle = (
  search: LibrarySearch,
  collection: Collection | undefined,
  sources: Source[],
) => {
  if (collection) {
    return collection.name
  }
  if (search.tag) {
    return `#${search.tag}`
  }
  const source = sources.find((s) => s.id === search.source)
  if (source) {
    return baseName(source.path)
  }
  return search.view ? VIEW_TITLES[search.view] : 'Bibliothèque'
}

function LibraryPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/' })
  const { models, isPending } = useModels()
  const { data: sources = [] } = useSourcesQuery()
  const { data: scan } = useScanQuery()
  const { data: collections = [] } = useCollectionsQuery()
  const { data: prefs } = usePreferencesQuery()
  const { open } = useOpenInSlicer()
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [cardSize, setCardSize] = useState(readCardSize)
  const [query, setQuery] = useState(search.q ?? '')
  const searchRef = useRef<HTMLInputElement>(null)

  // Saisie fluide : l'URL n'est mise à jour qu'après une courte pause.
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((search.q ?? '') !== query) {
        void navigate({
          search: (prev) => ({ ...prev, q: query || undefined }),
          replace: true,
        })
      }
    }, 180)
    return () => clearTimeout(timer)
  }, [query, search.q, navigate])

  // ⌘K / Ctrl+K : recherche ; Échap : vide la sélection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'Escape') {
        setSelection(new Set())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const filtered = useMemo(
    () => filterModels(models, search, prefs?.printers),
    [models, search, prefs?.printers],
  )
  const selectedModels = useMemo(
    () => models.filter((m) => selection.has(m.path)),
    [models, selection],
  )

  // Entrée : la sélection part au slicer (hors saisie dans un champ).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest(
        'input, textarea, select',
      )
      if (e.key === 'Enter' && !typing && selectedModels.length > 0) {
        e.preventDefault()
        void open(selectedModels)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedModels, open])

  const collection = collections.find((c) => c.id === search.collection)
  const title = libraryTitle(search, collection, sources)

  const changeCardSize = (size: number) => {
    setCardSize(size)
    try {
      localStorage.setItem(CARD_SIZE_KEY, String(size))
    } catch {
      // stockage indisponible (navigation privée) : la taille reste celle de la session
    }
  }

  if (!isPending && sources.length === 0) {
    return (
      <EmptyState icon={<FolderPlus />} title="Votre bibliothèque est vide">
        <p>
          Indiquez à Printshelf les dossiers où se trouvent déjà vos modèles.
          Rien n'est déplacé, renommé ni envoyé en ligne.
        </p>
        <Link to="/reglages" className="mt-5 inline-flex">
          <Button variant="primary">
            <FolderPlus /> Ajouter un dossier
          </Button>
        </Link>
      </EmptyState>
    )
  }

  return (
    <>
      <header className="flex flex-col gap-3 border-b border-line px-6 pt-5 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto flex items-baseline gap-3">
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              {collection && (
                <span
                  className="size-3 rounded-[5px]"
                  style={{ background: collection.color }}
                />
              )}
              {title}
            </h1>
            <span className="font-mono text-xs text-ink-mute tabular-nums">
              {filtered.length === models.length
                ? plural(models.length, 'modèle')
                : `${filtered.length.toLocaleString('fr-FR')} / ${models.length.toLocaleString('fr-FR')}`}
            </span>
            {scan?.running && (
              <Loader2
                className="size-3.5 animate-spin text-accent"
                aria-label="Scan en cours"
              />
            )}
          </div>

          <label className="relative flex h-9 w-full max-w-sm items-center sm:w-80">
            <Search className="pointer-events-none absolute left-3 size-4 text-ink-mute" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nom, dossier, tag, note…"
              className="size-full rounded-lg border border-line bg-surface pr-12 pl-9 outline-none placeholder:text-ink-mute focus:border-accent/60"
            />
            <span className="kbd absolute right-2.5">⌘K</span>
          </label>
        </div>

        <LibraryFilters
          search={search}
          cardSize={cardSize}
          onCardSize={changeCardSize}
        />
      </header>

      <div className="min-h-0 flex-1">
        {filtered.length === 0 && !isPending ? (
          <EmptyState
            icon={<SearchX />}
            title={scan?.running ? 'Scan en cours…' : 'Aucun modèle ici'}
          >
            {scan?.running
              ? 'Les modèles apparaissent à la fin du scan.'
              : 'Essayez une autre recherche ou retirez un filtre.'}
          </EmptyState>
        ) : (
          <ModelGrid
            models={filtered}
            cardSize={cardSize}
            selection={selection}
            onSelectionChange={setSelection}
          />
        )}
      </div>

      {selectedModels.length > 0 && (
        <SelectionBar
          models={selectedModels}
          onClear={() => setSelection(new Set())}
        />
      )}
    </>
  )
}

function LibraryFilters({
  search,
  cardSize,
  onCardSize,
}: {
  search: LibrarySearch
  cardSize: number
  onCardSize: (size: number) => void
}) {
  const printers = usePreferencesQuery().data?.printers ?? []
  const navigate = useNavigate({ from: '/' })
  const setSearch = (patch: Partial<LibrarySearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })
  const filtered =
    search.collection ||
    search.tag ||
    search.source !== undefined ||
    search.view

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5">
        {['', ...FORMATS].map((fmt) => (
          <button
            key={fmt || 'all'}
            type="button"
            onClick={() => setSearch({ fmt: fmt || undefined })}
            className={cn(
              'h-7 rounded-md px-2.5 font-mono text-[11px] tracking-wide text-ink-mute uppercase hover:text-ink',
              (search.fmt ?? '') === fmt && 'bg-raised text-ink',
            )}
          >
            {fmt || 'Tous'}
          </button>
        ))}
      </div>

      {filtered && (
        <Link
          to="/"
          search={{ q: search.q, fmt: search.fmt, sort: search.sort }}
        >
          <Button size="sm" variant="ghost">
            <X /> Retirer le filtre
          </Button>
        </Link>
      )}

      <div className="ml-auto flex items-center gap-3">
        {printers.length > 0 && (
          <select
            aria-label="Imprimable sur"
            value={search.printer ?? ''}
            onChange={(e) =>
              setSearch({ printer: e.target.value || undefined })
            }
            className="h-8 rounded-lg border border-line bg-surface px-2 text-ink-soft outline-none"
          >
            <option value="">Toutes tailles</option>
            {printers.map((p) => (
              <option key={p.id} value={p.id}>
                Tient sur {p.name}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Trier"
          value={search.sort ?? 'name'}
          onChange={(e) =>
            setSearch({ sort: e.target.value as LibrarySearch['sort'] })
          }
          className="h-8 rounded-lg border border-line bg-surface px-2 text-ink-soft outline-none"
        >
          <option value="name">Nom</option>
          <option value="recent">Plus récents</option>
          <option value="size">Plus lourds</option>
        </select>
        <input
          type="range"
          min={140}
          max={340}
          step={10}
          value={cardSize}
          onChange={(e) => onCardSize(Number(e.target.value))}
          aria-label="Taille des miniatures"
          className="w-24 accent-(--color-accent)"
        />
      </div>
    </div>
  )
}
