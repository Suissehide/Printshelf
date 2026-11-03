import { createFileRoute } from '@tanstack/react-router'
import {
  CloudOff,
  Download,
  FolderOpen,
  FolderPlus,
  ImageOff,
  Laptop,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react'
import type { ChangeEvent } from 'react'

import { SystemApi } from '@/api/system.api.ts'
import { ExtensionPanel } from '@/components/settings/extension-panel.tsx'
import { FolderField } from '@/components/settings/folder-field.tsx'
import { Panel } from '@/components/settings/panel.tsx'
import { PrintersPanel } from '@/components/settings/printers-panel.tsx'
import { SlicersPanel } from '@/components/settings/slicers-panel.tsx'
import { Button } from '@/components/ui/button.tsx'
import { confirmDialog } from '@/components/ui/dialog.tsx'
import { PageHeader } from '@/components/ui/page-header.tsx'
import { toastError } from '@/hooks/useToast.ts'
import {
  useModels,
  useScanQuery,
  useSourceMutations,
  useSourcesQuery,
} from '@/queries/useLibrary.ts'
import {
  useCapabilities,
  useSyncQuery,
  useSystemActions,
} from '@/queries/useSystem.ts'
import { formatRelative, plural } from '@/utils/format.ts'

export const Route = createFileRoute('/reglages')({ component: SettingsPage })

function SourcesPanel() {
  const { sourcesRoot } = useCapabilities()
  const { data: sources = [] } = useSourcesQuery()
  const { data: scan } = useScanQuery()
  const { models } = useModels()
  const { addSource, removeSource, startScan, resetThumbnails } =
    useSourceMutations()
  const scanLabel = scan?.running
    ? `${scan.processed.toLocaleString('fr-FR')} fichiers parcourus`
    : `Dernier scan ${formatRelative(scan?.lastFinishedAt ?? null)}${scan?.errors ? ` · ${scan.errors} fichier(s) illisible(s)` : ''}`

  return (
    <Panel
      title="Sources"
      description={
        <>
          Les dossiers où vivent déjà vos modèles, sous-dossiers et archives ZIP
          compris. Rien n'est déplacé ni modifié.
          {sourcesRoot && (
            <>
              {' '}
              Sur ce serveur, les sources doivent se trouver sous{' '}
              <code className="font-mono">{sourcesRoot}</code>.
            </>
          )}
        </>
      }
    >
      {sources.map((s) => (
        <div
          key={s.id}
          className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5"
        >
          <FolderOpen className="size-4 shrink-0 text-accent" />
          <span
            className="min-w-0 flex-1 truncate font-mono text-xs"
            title={s.path}
          >
            {s.path}
          </span>
          <span className="text-xs text-ink-mute">
            {plural(
              models.filter((m) => m.source_id === s.id).length,
              'modèle',
            )}
          </span>
          <Button
            size="icon"
            variant="danger"
            aria-label={`Retirer ${s.path}`}
            onClick={async () =>
              (await confirmDialog('Retirer ce dossier de la bibliothèque ?', {
                message: `${s.path} — aucun fichier ne sera supprimé.`,
                confirmLabel: 'Retirer',
                danger: true,
              })) && removeSource.mutate(s.id)
            }
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <FolderField
        placeholder={
          sourcesRoot
            ? `${sourcesRoot}/…`
            : 'Chemin du dossier, ex. /Users/moi/Impression 3D'
        }
        submitLabel="Ajouter"
        onSubmit={(path) => addSource.mutate(path)}
      />
      <div className="flex items-center gap-3 text-xs text-ink-mute">
        <Button
          size="sm"
          onClick={() => startScan.mutate()}
          disabled={scan?.running}
        >
          <RefreshCw className={scan?.running ? 'animate-spin' : ''} />{' '}
          {scan?.running ? 'Scan en cours…' : 'Rescanner'}
        </Button>
        <Button
          size="sm"
          onClick={async () =>
            (await confirmDialog('Régénérer toutes les miniatures ?', {
              message:
                'Le cache est vidé : chaque miniature est relue dans son fichier ou redessinée à l’affichage. Utile si un aperçu ne correspond pas à son modèle.',
              confirmLabel: 'Régénérer',
            })) && resetThumbnails.mutate()
          }
        >
          <ImageOff /> Régénérer les miniatures
        </Button>
        {scanLabel}
      </div>
    </Panel>
  )
}

function SyncPanel() {
  const { data: sync } = useSyncQuery()
  const { setSyncFolder, syncNow } = useSystemActions()

  return (
    <Panel
      title="Synchronisation"
      description="Tags, notes, favoris, collections et file d'impression suivent vos modèles d'un ordinateur à l'autre, via un dossier déjà synchronisé (iCloud Drive, Dropbox, OneDrive…). Choisissez le même dossier sur chaque ordinateur."
    >
      {sync?.folder ? (
        <>
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
            <span
              className={`size-2 shrink-0 rounded-full ${sync.error ? 'bg-danger' : 'bg-ok'}`}
            />
            <span
              className="min-w-0 flex-1 truncate font-mono text-xs"
              title={sync.folder}
            >
              {sync.folder}
            </span>
            <Button size="sm" onClick={() => syncNow.mutate()}>
              <RefreshCw className={syncNow.isPending ? 'animate-spin' : ''} />{' '}
              Synchroniser
            </Button>
            <Button
              size="icon"
              variant="danger"
              aria-label="Arrêter la synchronisation"
              onClick={() => setSyncFolder.mutate(null)}
            >
              <CloudOff />
            </Button>
          </div>
          {sync.error && <p className="text-xs text-danger">{sync.error}</p>}
          <ul className="flex flex-col gap-1.5 text-xs">
            <li className="flex items-center gap-2 text-ink">
              <Laptop className="size-3.5 text-accent" /> {sync.deviceName}{' '}
              <span className="text-ink-mute">
                (cet ordinateur · envoi {formatRelative(sync.lastExportAt)})
              </span>
            </li>
            {sync.devices.map((d) => (
              <li
                key={d.deviceId}
                className="flex items-center gap-2 text-ink-soft"
              >
                <Laptop className="size-3.5 text-ink-mute" /> {d.deviceName}{' '}
                <span className="text-ink-mute">
                  (dernier envoi {formatRelative(d.exportedAt)})
                </span>
              </li>
            ))}
            {sync.devices.length === 0 && (
              <li className="text-ink-mute">
                Aucun autre ordinateur pour l'instant : choisissez ce même
                dossier sur l'autre machine.
              </li>
            )}
          </ul>
        </>
      ) : (
        <FolderField
          placeholder="Dossier synchronisé, ex. ~/Library/Mobile Documents/com~apple~CloudDocs"
          submitLabel="Activer"
          onSubmit={(folder) => setSyncFolder.mutate(folder)}
        />
      )}
    </Panel>
  )
}

function BackupPanel() {
  const { restore } = useSystemActions()

  const onRestore = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) {
      try {
        restore.mutate(JSON.parse(await file.text()))
      } catch {
        toastError(
          new Error('Ce fichier n’est pas une sauvegarde Printshelf valide'),
        )
      }
    }
  }

  return (
    <Panel
      title="Sauvegarde"
      description="Un seul fichier avec vos tags, notes, collections et file d'impression. La restauration fusionne : rien de plus récent n'est écrasé."
    >
      <div className="flex flex-wrap gap-2">
        <a href={SystemApi.backupUrl} download>
          <Button>
            <Download /> Télécharger une sauvegarde
          </Button>
        </a>
        <label className="inline-flex">
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={onRestore}
          />
          <span className="inline-flex h-8.5 cursor-pointer items-center gap-2 rounded-lg border border-line bg-raised px-3 hover:border-line-strong hover:bg-overlay [&_svg]:size-4">
            <Upload /> Restaurer…
          </span>
        </label>
      </div>
    </Panel>
  )
}

function SettingsPage() {
  const { desktop } = useCapabilities()

  return (
    <div className="h-full overflow-y-auto">
      <PageHeader
        title="Réglages"
        subtitle={desktop ? 'App de bureau' : 'Installation serveur'}
      />
      <div className="mx-auto max-w-5xl px-6">
        <SourcesPanel />
        <SyncPanel />
        {desktop && <SlicersPanel />}
        <PrintersPanel />
        {desktop && <ExtensionPanel />}
        <BackupPanel />
        {!desktop && (
          <Panel
            title="Mode serveur"
            description="Cette installation tourne sur un serveur : ouvrir dans le slicer et afficher dans le Finder sont remplacés par le téléchargement."
          >
            <span className="flex items-center gap-2 text-ink-mute">
              <FolderPlus className="size-4" /> Ajoutez les dossiers montés dans
              le conteneur.
            </span>
          </Panel>
        )}
      </div>
    </div>
  )
}
