import {
  Download,
  FolderInput,
  ListPlus,
  Send,
  Star,
  Tag,
  User,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button.tsx'
import { formDialog, promptDialog } from '@/components/ui/dialog.tsx'
import { useGroupIntoFolder } from '@/hooks/useGroupIntoFolder.ts'
import { useOpenInSlicer } from '@/hooks/useOpenInSlicer.ts'
import {
  useCollectionMutations,
  useCollectionsQuery,
  useMetaMutation,
  useQueueMutations,
} from '@/queries/useOrganizer.ts'
import type { Model } from '@/types/library.ts'
import { plural } from '@/utils/format.ts'

// Actions groupées sur la sélection (Cmd/Ctrl-clic, Maj-clic pour une plage).
export const SelectionBar = ({
  models,
  onClear,
}: {
  models: Model[]
  onClear: () => void
}) => {
  const { data: collections = [] } = useCollectionsQuery()
  const { setModels } = useCollectionMutations()
  const meta = useMetaMutation()
  const queue = useQueueMutations()
  const { open, desktop } = useOpenInSlicer()
  const groupIntoFolder = useGroupIntoFolder()
  // Les fichiers d'une archive ne peuvent pas être déplacés.
  const movable = desktop && models.every((m) => !m.archive)
  const hashes = [...new Set(models.map((m) => m.hash))]

  const addTag = async () => {
    const tag = (
      await promptDialog(
        `Ajouter un tag à ${plural(models.length, 'modèle')}`,
        { placeholder: 'ex. figurine', confirmLabel: 'Ajouter' },
      )
    )?.toLowerCase()
    if (tag) {
      for (const m of models) {
        meta.mutate({ hash: m.hash, tags: [...new Set([...m.tags, tag])] })
      }
    }
  }

  // Créateur et page d'origine de toute la sélection (un champ vide ne change rien).
  const setSource = async () => {
    const values = await formDialog(
      `Créateur et source de ${plural(models.length, 'modèle')}`,
      [
        { name: 'creator', label: 'Créateur', placeholder: 'ex. Ellie' },
        {
          name: 'sourceUrl',
          label: "Page d'origine",
          type: 'url',
          placeholder: 'https://www.printables.com/model/…',
          maxLength: 500,
        },
      ],
      {
        message: 'Un champ laissé vide ne modifie rien.',
        confirmLabel: 'Appliquer',
      },
    )
    const patch = {
      ...(values?.creator && { creator: values.creator }),
      ...(values?.sourceUrl && { sourceUrl: values.sourceUrl }),
    }
    if (Object.keys(patch).length) {
      for (const hash of hashes) {
        meta.mutate({ hash, ...patch })
      }
    }
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-line-strong bg-overlay p-1.5 pl-4 shadow-(--shadow-pop)">
        <span className="mr-2 flex flex-col leading-tight">
          <span className="font-medium text-ink">
            {plural(
              models.length,
              'modèle sélectionné',
              'modèles sélectionnés',
            )}
          </span>
          <span className="text-[11px] text-ink-mute">
            Clic : cocher · Maj-clic : une plage · Échap : fin
          </span>
        </span>
        <select
          aria-label="Ajouter à une collection"
          className="h-8 rounded-lg border border-line bg-raised px-2 text-ink outline-none"
          value=""
          onChange={(e) =>
            e.target.value &&
            setModels.mutate({ id: e.target.value, hashes, included: true })
          }
        >
          <option value="">Ajouter à une collection…</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Button size="md" onClick={addTag}>
          <Tag /> Tag
        </Button>
        <Button size="md" onClick={setSource}>
          <User /> Source
        </Button>
        {movable && (
          <Button
            size="md"
            onClick={async () => (await groupIntoFolder(models)) && onClear()}
          >
            <FolderInput /> Dossier
          </Button>
        )}
        <Button
          size="md"
          onClick={() => {
            for (const hash of hashes) {
              meta.mutate({ hash, favorite: true })
            }
          }}
        >
          <Star /> Favori
        </Button>
        <Button
          size="md"
          onClick={() => {
            for (const m of models) {
              queue.add.mutate({ hash: m.hash, name: m.name })
            }
          }}
        >
          <ListPlus /> File
        </Button>
        {(desktop || models.length === 1) && (
          <Button size="md" variant="primary" onClick={() => open(models)}>
            {desktop ? <Send /> : <Download />}
            {desktop ? 'Slicer' : 'Télécharger'}
            {desktop && (
              <span className="kbd border-accent-ink/30 bg-transparent text-accent-ink">
                ↵
              </span>
            )}
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          aria-label="Vider la sélection"
          onClick={onClear}
        >
          <X />
        </Button>
      </div>
    </div>
  )
}
