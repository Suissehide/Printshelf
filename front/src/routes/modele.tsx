import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import {
  Archive,
  ArrowLeft,
  Box,
  Check,
  Download,
  ExternalLink,
  FolderSearch,
  ListPlus,
  Star,
  X,
} from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'

import { LibraryApi } from '@/api/library.api.ts'
import { CompanionsPanel } from '@/components/model/companions-panel.tsx'
import { PrintPanel } from '@/components/model/print-panel.tsx'
import { SourcePanel } from '@/components/model/source-panel.tsx'
import { Button } from '@/components/ui/button.tsx'
import { EmptyState } from '@/components/ui/empty-state.tsx'
import { TagInput } from '@/components/ui/tag-input.tsx'
import { ModelViewer } from '@/components/viewer/model-viewer.tsx'
import { useOpenInSlicer } from '@/hooks/useOpenInSlicer.ts'
import { fitsOn, resolveSlicer } from '@/libs/library/slicer.ts'
import { suggestTags } from '@/libs/library/tags.ts'
import type { LoadedModel } from '@/libs/three/load-model.ts'
import {
  useModels,
  usePrintInfoQuery,
  useSourcesQuery,
} from '@/queries/useLibrary.ts'
import {
  useCollectionMutations,
  useCollectionsQuery,
  useMetaMutation,
  useMetasQuery,
  usePreferencesQuery,
  useQueueMutations,
} from '@/queries/useOrganizer.ts'
import {
  useCapabilities,
  useSlicersQuery,
  useSystemActions,
} from '@/queries/useSystem.ts'
import type { Dimensions, Model } from '@/types/library.ts'
import { cn } from '@/utils/cn.ts'
import { formatDate, formatSize, sourceRelativeDir } from '@/utils/format.ts'
import { shortcutAllowed } from '@/utils/keyboard.ts'

export const Route = createFileRoute('/modele')({
  validateSearch: (raw: Record<string, unknown>) => ({
    path: typeof raw.path === 'string' ? raw.path : '',
  }),
  component: ModelPage,
})

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <section className="flex flex-col gap-2">
    <h3 className="text-[10.5px] font-semibold tracking-[0.12em] text-ink-mute uppercase">
      {label}
    </h3>
    {children}
  </section>
)

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-line bg-surface px-3 py-2">
    <div className="text-[11px] text-ink-mute">{label}</div>
    <div className="mt-0.5 font-mono text-[13px] text-ink tabular-nums">
      {value}
    </div>
  </div>
)

const mm = (v: number) =>
  `${v.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}`

const ModelActions = ({ model }: { model: Model }) => {
  const { data: slicers = [] } = useSlicersQuery()
  const { desktop } = useCapabilities()
  const queue = useQueueMutations()
  const { reveal } = useSystemActions()
  const { open } = useOpenInSlicer()
  const { data: prefs } = usePreferencesQuery()
  // null = choix automatique (règles par tag, slicer par défaut) ; '' = application par défaut.
  const [choice, setChoice] = useState<string | null>(null)
  const slicerId = choice ?? resolveSlicer(model, prefs?.slicers, slicers) ?? ''
  const send = () => open([model], slicerId || null)

  // Entrée : envoyer au slicer (hors saisie dans un champ).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === 'Enter' &&
        shortcutAllowed(e, 'input, textarea, select, button')
      ) {
        e.preventDefault()
        void open([model], slicerId || null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, model, slicerId])

  return (
    <div className="flex flex-col gap-2">
      {desktop ? (
        <div className="flex gap-2">
          <Button
            variant="primary"
            className="flex-1 justify-center"
            onClick={send}
          >
            <ExternalLink /> Ouvrir {slicers.length ? 'dans' : ''}
            <span className="kbd border-accent-ink/30 bg-transparent text-accent-ink">
              ↵
            </span>
          </Button>
          {slicers.length > 0 && (
            <select
              aria-label="Slicer"
              value={slicerId}
              onChange={(e) => setChoice(e.target.value)}
              className="h-8.5 min-w-0 flex-1 rounded-lg border border-line bg-raised px-2 text-ink outline-none"
            >
              {slicers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value="">Application par défaut</option>
            </select>
          )}
        </div>
      ) : (
        <a href={LibraryApi.downloadUrl(model.path)}>
          <Button variant="primary" className="w-full justify-center">
            <Download /> Télécharger
          </Button>
        </a>
      )}
      <div className="flex gap-2">
        {desktop && (
          <Button
            className="flex-1 justify-center"
            onClick={() => reveal.mutate(model.path)}
          >
            <FolderSearch /> Afficher
          </Button>
        )}
        <Button
          className="flex-1 justify-center"
          onClick={() =>
            queue.add.mutate({ hash: model.hash, name: model.name })
          }
        >
          <ListPlus /> File d'impression
        </Button>
      </div>
    </div>
  )
}

const CollectionsField = ({ model }: { model: Model }) => {
  const { data: collections = [] } = useCollectionsQuery()
  const { setModels } = useCollectionMutations()

  return (
    <Field label="Collections">
      {collections.length === 0 ? (
        <p className="text-ink-mute">
          Créez une collection avec le « + » de la barre latérale.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {collections.map((c) => {
            const included = model.collectionIds.includes(c.id)
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={included}
                onClick={() =>
                  setModels.mutate({
                    id: c.id,
                    hashes: [model.hash],
                    included: !included,
                  })
                }
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors',
                  included
                    ? 'border-transparent bg-raised text-ink'
                    : 'border-dashed border-line text-ink-mute hover:text-ink',
                )}
              >
                <span
                  className="size-2 rounded-[3px]"
                  style={{ background: c.color, opacity: included ? 1 : 0.5 }}
                />
                {c.name}
              </button>
            )
          })}
        </div>
      )}
    </Field>
  )
}

// Dimensions mesurées par le back (repère d'impression) et compatibilité avec chaque imprimante.
const FitField = ({ dims }: { dims: Dimensions | null }) => {
  const printers = usePreferencesQuery().data?.printers ?? []
  if (!(dims && printers.length)) {
    return null
  }
  return (
    <Field label="Plateaux">
      <ul className="flex flex-col gap-1">
        {printers.map((p) => {
          const fits = fitsOn(dims, p)
          return (
            <li key={p.id} className="flex items-center gap-2 text-xs">
              {fits ? (
                <Check className="size-3.5 text-ok" />
              ) : (
                <X className="size-3.5 text-danger" />
              )}
              <span className={fits ? 'text-ink' : 'text-ink-mute'}>
                {p.name}
              </span>
              <span className="ml-auto font-mono text-[11px] text-ink-mute">
                {p.x} × {p.y} × {p.z}
              </span>
            </li>
          )
        })}
      </ul>
    </Field>
  )
}

// Section masquée tant qu'il n'y a rien à montrer.
const CompanionsSection = ({ path }: { path: string }) => (
  <section className="flex flex-col gap-2 empty:hidden [&:not(:has(a))]:hidden">
    <h3 className="text-[10.5px] font-semibold tracking-[0.12em] text-ink-mute uppercase">
      Fichiers joints
    </h3>
    <CompanionsPanel path={path} />
  </section>
)

// Mesure du back (par objet pour un projet à plusieurs plateaux), sinon la scène.
const dimsLabel = (model: Model, loaded: LoadedModel | null) => {
  if (model.dims) {
    return `${mm(model.dims.x)} × ${mm(model.dims.y)} × ${mm(model.dims.z)}`
  }
  return loaded
    ? `${mm(loaded.size.x)} × ${mm(loaded.size.z)} × ${mm(loaded.size.y)}`
    : '…'
}

function ModelPage() {
  const { path } = Route.useSearch()
  const router = useRouter()
  const { models, isPending } = useModels()
  const { data: sources = [] } = useSourcesQuery()
  // Les champs modifiables partent des valeurs enregistrées : on attend qu'elles soient là.
  const metasLoaded = useMetasQuery().isSuccess
  const model = models.find((m) => m.path === path)
  const meta = useMetaMutation()
  const [loaded, setLoaded] = useState<LoadedModel | null>(null)
  const [notes, setNotes] = useState('')
  // Le plateau choisi ne vaut que pour CE modèle : passer à une copie repart de « tous ».
  const [plateFor, setPlateFor] = useState<{
    path: string
    plate: number | null
  }>({ path, plate: null })
  const plate = plateFor.path === path ? plateFor.plate : null
  const setPlate = (next: number | null) => setPlateFor({ path, plate: next })
  const { data: printInfo } = usePrintInfoQuery(model)

  useEffect(() => setNotes(model?.notes ?? ''), [model?.notes])

  const allTags = useMemo(
    () => [...new Set(models.flatMap((m) => m.tags))].sort(),
    [models],
  )
  const copies = useMemo(
    () =>
      models.filter(
        (m) => model && m.hash === model.hash && m.path !== model.path,
      ),
    [models, model],
  )

  if (!model) {
    return isPending ? null : (
      <EmptyState icon={<Box />} title="Modèle introuvable">
        Il a peut-être été déplacé depuis le dernier scan.
      </EmptyState>
    )
  }

  const back = () =>
    window.history.length > 1
      ? router.history.back()
      : router.navigate({ to: '/' })

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[1fr_360px]">
      <div className="relative min-h-[50vh]">
        <ModelViewer
          path={model.path}
          ext={model.ext}
          name={model.name}
          printInfo={printInfo}
          plate={plate}
          onLoaded={setLoaded}
        />
        <Button
          variant="secondary"
          size="sm"
          className="absolute top-4 left-4"
          onClick={back}
        >
          <ArrowLeft /> Retour
        </Button>
      </div>

      <aside className="flex min-h-0 flex-col gap-6 overflow-y-auto border-l border-line bg-canvas p-5">
        <div>
          <div className="flex items-start gap-2">
            <h1 className="flex-1 text-lg leading-snug font-semibold break-words">
              {model.name}
            </h1>
            <Button
              size="icon"
              variant="ghost"
              aria-pressed={model.favorite}
              aria-label={
                model.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'
              }
              onClick={() =>
                meta.mutate({ hash: model.hash, favorite: !model.favorite })
              }
              className="[&_svg]:size-5 aria-pressed:text-accent"
            >
              <Star className={cn(model.favorite && 'fill-current')} />
            </Button>
          </div>
          <p
            className="mt-1 text-xs break-words text-ink-mute"
            title={model.dir}
          >
            {sourceRelativeDir(model.dir, sources)}
          </p>
          {model.archive && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-raised px-2 py-1 text-xs text-ink-soft">
              <Archive className="size-3.5" /> Dans une archive, lu sans
              extraction
            </p>
          )}
        </div>

        <ModelActions model={model} />

        <div className="grid grid-cols-2 gap-2">
          <Stat label="Dimensions (mm)" value={dimsLabel(model, loaded)} />
          <Stat
            label="Triangles"
            value={
              loaded
                ? Math.round(loaded.triangles).toLocaleString('fr-FR')
                : '…'
            }
          />
          <Stat label="Taille" value={formatSize(model.size)} />
          <Stat label="Modifié" value={formatDate(model.mtime)} />
        </div>

        <FitField dims={model.dims} />

        {printInfo?.slicer && (
          <Field
            label={
              printInfo.slicer === 'bambu'
                ? 'Projet Bambu / Orca'
                : 'Projet PrusaSlicer'
            }
          >
            <PrintPanel
              path={model.path}
              info={printInfo}
              plate={plate}
              onPlate={setPlate}
            />
          </Field>
        )}

        {metasLoaded && (
          <Field label="Créateur et source">
            <SourcePanel key={model.path} model={model} />
          </Field>
        )}

        <Field label="Tags">
          <TagInput
            tags={model.tags}
            suggestions={allTags}
            proposed={suggestTags(
              model,
              sources.find((src) => src.id === model.source_id)?.path,
              allTags,
            )}
            onChange={(tags) => meta.mutate({ hash: model.hash, tags })}
          />
        </Field>

        <CollectionsField model={model} />

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() =>
              notes !== model.notes && meta.mutate({ hash: model.hash, notes })
            }
            rows={4}
            placeholder="Réglages d'impression, support, couleur de filament…"
            className="resize-y rounded-lg border border-line bg-surface px-3 py-2 outline-none placeholder:text-ink-mute focus:border-accent/60"
          />
        </Field>

        <CompanionsSection path={model.path} />

        {copies.length > 0 && (
          <Field label={`Copies identiques (${copies.length})`}>
            <ul className="flex flex-col gap-1">
              {copies.map((c) => (
                <li key={c.path}>
                  <Link
                    to="/modele"
                    search={{ path: c.path }}
                    className="block truncate text-xs text-warn hover:underline"
                    title={c.path}
                  >
                    {sourceRelativeDir(c.dir, sources)} › {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </Field>
        )}
      </aside>
    </div>
  )
}
