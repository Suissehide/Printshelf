import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  ChevronRight,
  Folder,
  FolderPlus,
  LayoutGrid,
  Loader2,
  Search,
  SearchX,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { ModelGrid } from '@/components/library/model-grid.tsx'
import { SelectionBar } from '@/components/library/selection-bar.tsx'
import { Button } from '@/components/ui/button.tsx'
import { EmptyState } from '@/components/ui/empty-state.tsx'
import { Segment } from '@/components/ui/segment.tsx'
import { useOpenInSlicer } from '@/hooks/useOpenInSlicer.ts'
import {
  browsingFolders,
  filterModels,
  isNarrowed,
  type LibrarySearch,
  validateLibrarySearch,
} from '@/libs/library/filters.ts'
import {
  browseFolder,
  currentFolder,
  type FolderListing,
} from '@/libs/library/folders.ts'
import {
  useModels,
  useScanQuery,
  useSourcesQuery,
} from '@/queries/useLibrary.ts'
import {
  useCollectionsQuery,
  usePreferencesQuery,
} from '@/queries/useOrganizer.ts'
import type { Collection, Model, Source } from '@/types/library.ts'
import { baseName, plural } from '@/utils/format.ts'
import { shortcutAllowed } from '@/utils/keyboard.ts'

export const Route = createFileRoute('/')({
  validateSearch: validateLibrarySearch,
  component: LibraryPage,
})

const FORMATS = ['3mf', 'stl', 'obj', 'ply', 'glb', 'step', 'gcode']
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

// Navigation par dossiers (sauf recherche ou filtre) : sous-dossiers puis fichiers du dossier.
const useFolderListing = (
  filtered: Model[],
  sources: Source[],
  search: LibrarySearch,
) =>
  useMemo(
    () =>
      browsingFolders(search)
        ? browseFolder(
            filtered,
            sources,
            currentFolder(
              sources,
              search.dir,
              search.source,
              isNarrowed(search) ? filtered : undefined,
            ),
          )
        : null,
    [filtered, sources, search],
  )

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
      } else if (e.key === 'Escape' && shortcutAllowed(e, 'textarea')) {
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
  const listing = useFolderListing(filtered, sources, search)
  const openFolder = (dir: string) =>
    navigate({ search: (prev) => ({ ...prev, dir: dir || undefined }) })
  const shownCount = listing
    ? listing.folders.length + listing.files.length
    : filtered.length
  const selectedModels = useMemo(
    () => models.filter((m) => selection.has(m.path)),
    [models, selection],
  )

  // Entrée : la sélection part au slicer (hors saisie dans un champ).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === 'Enter' &&
        shortcutAllowed(e) &&
        selectedModels.length > 0
      ) {
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
        {listing && (
          <FolderCrumbs
            listing={listing}
            multipleSources={sources.length > 1}
            onOpen={openFolder}
          />
        )}
      </header>

      <div className="min-h-0 flex-1">
        {shownCount === 0 && !isPending ? (
          <NothingHere scanning={!!scan?.running} />
        ) : (
          <ModelGrid
            folders={listing?.folders}
            onOpenFolder={openFolder}
            models={listing ? listing.files : filtered}
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

const NothingHere = ({ scanning }: { scanning: boolean }) => (
  <EmptyState
    icon={<SearchX />}
    title={scanning ? 'Scan en cours…' : 'Aucun modèle ici'}
  >
    {scanning
      ? 'Les modèles apparaissent à la fin du scan.'
      : 'Essayez une autre recherche ou retirez un filtre.'}
  </EmptyState>
)

// Fil d'Ariane du dossier parcouru : chaque étape ramène à ce dossier.
function FolderCrumbs({
  listing,
  multipleSources,
  onOpen,
}: {
  listing: FolderListing
  multipleSources: boolean
  onOpen: (dir: string) => void
}) {
  const crumbs = [
    ...(multipleSources ? [{ path: '', name: 'Sources' }] : []),
    ...listing.crumbs,
  ]
  return (
    <nav
      aria-label="Dossier"
      className="flex min-w-0 flex-wrap items-center gap-0.5 text-[13px]"
    >
      <Folder className="mr-1 size-4 shrink-0 text-accent" />
      {crumbs.map((c, i) => (
        <span key={c.path} className="flex min-w-0 items-center gap-0.5">
          {i > 0 && <ChevronRight className="size-3.5 text-ink-mute" />}
          {i === crumbs.length - 1 ? (
            <span className="truncate font-medium text-ink">{c.name}</span>
          ) : (
            <button
              type="button"
              onClick={() => onOpen(c.path)}
              className="truncate rounded px-1 text-ink-soft hover:bg-raised hover:text-ink"
            >
              {c.name}
            </button>
          )}
        </span>
      ))}
    </nav>
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
          <Segment
            key={fmt || 'all'}
            active={(search.fmt ?? '') === fmt}
            onClick={() => setSearch({ fmt: fmt || undefined })}
            className="font-mono text-[11px] tracking-wide uppercase"
          >
            {fmt || 'Tous'}
          </Segment>
        ))}
      </div>

      {browsingFolders({ ...search, layout: undefined }) && (
        <div className="flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5">
          <Segment
            active={search.layout !== 'flat'}
            onClick={() => setSearch({ layout: undefined })}
            title="Parcourir par dossiers"
          >
            <Folder className="size-3.5" />
          </Segment>
          <Segment
            active={search.layout === 'flat'}
            onClick={() => setSearch({ layout: 'flat', dir: undefined })}
            title="Tous les modèles à plat"
          >
            <LayoutGrid className="size-3.5" />
          </Segment>
        </div>
      )}

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
