import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Puzzle } from 'lucide-react'

import { request } from '@/api/http.ts'
import { toastError } from '@/hooks/useToast.ts'
import { FolderField } from './folder-field.tsx'
import { Panel } from './panel.tsx'

const KEY = ['imports', 'folder']
type ImportFolder = { folder: string | null }

// Extension « Enregistrer dans Printshelf » : où vont les téléchargements, et comment l'installer.
export const ExtensionPanel = () => {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: KEY,
    queryFn: () => request<ImportFolder>('/imports/folder'),
  })
  const setFolder = useMutation({
    mutationFn: (folder: string | null) =>
      request<ImportFolder>('/imports/folder', {
        method: 'PUT',
        json: { folder },
      }),
    onSuccess: (result) => queryClient.setQueryData(KEY, result),
    onError: toastError,
  })

  return (
    <Panel
      title="Extension de navigateur"
      description="Téléchargez un modèle sur Printables, MakerWorld, Thingiverse, Cults3D ou MyMiniFactory : il est rangé ici avec son image, son créateur et le lien de sa page. Le fichier téléchargé reste où il est."
    >
      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
        <Puzzle className="size-4 shrink-0 text-accent" />
        <span
          className="min-w-0 flex-1 truncate font-mono text-xs"
          title={data?.folder ?? undefined}
        >
          {data?.folder ?? 'Ajoutez d’abord une source'}
        </span>
      </div>
      <FolderField
        placeholder="Autre dossier d'import (ajouté aux sources si besoin)"
        submitLabel="Choisir"
        onSubmit={(folder) => setFolder.mutate(folder)}
      />
      <ol className="list-decimal space-y-1 pl-5 text-xs text-ink-soft">
        <li>
          Chrome, Edge ou Brave : ouvrez{' '}
          <code className="font-mono">chrome://extensions</code>, activez le{' '}
          <em>mode développeur</em>, puis{' '}
          <em>Charger l'extension non empaquetée</em> et choisissez le dossier{' '}
          <code className="font-mono">extension/</code> de Printshelf.
        </li>
        <li>
          Firefox : <code className="font-mono">about:debugging</code> →{' '}
          <em>Ce Firefox</em> → <em>Charger un module temporaire</em> →{' '}
          <code className="font-mono">extension/manifest.json</code>.
        </li>
        <li>Laissez Printshelf ouvert pendant vos téléchargements.</li>
      </ol>
    </Panel>
  )
}
