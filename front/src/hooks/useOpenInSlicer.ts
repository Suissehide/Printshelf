import { useQueryClient } from '@tanstack/react-query'

import { LibraryApi } from '../api/library.api.ts'
import { SystemApi } from '../api/system.api.ts'
import { QUERY_KEYS } from '../constants/query-keys.ts'
import { groupBySlicer } from '../libs/library/slicer.ts'
import { usePreferencesQuery } from '../queries/useOrganizer.ts'
import { useCapabilities, useSlicersQuery } from '../queries/useSystem.ts'
import type { Model, Slicer } from '../types/library.ts'
import { toast, toastError } from './useToast.ts'

type Opened = Pick<Model, 'path' | 'tags' | 'name'>

// Sans slicer (installation serveur) : un modèle seul est téléchargé.
const downloadSingle = (models: Opened[]) => {
  if (models.length === 1) {
    window.location.assign(LibraryApi.downloadUrl(models[0].path))
  }
}

const sentMessage = (
  models: Opened[],
  slicerIds: (string | undefined)[],
  slicers: Slicer[],
) => {
  const names = slicerIds.map(
    (id) =>
      slicers.find((s) => s.id === id)?.name ?? 'l’application par défaut',
  )
  return models.length === 1
    ? `« ${models[0].name} » envoyé à ${names[0]}`
    : `${models.length} modèles envoyés à ${names.join(' et ')}`
}

// Envoie un ou plusieurs modèles au slicer : chacun part vers SON slicer (règles par tag, slicer
// par défaut), en un seul appel par slicer pour qu'ils arrivent sur le même plateau.
// `slicerId` force un slicer précis (choix explicite dans la fiche du modèle).
// Sur une installation serveur, il n'y a pas de slicer : un modèle seul est téléchargé.
export const useOpenInSlicer = () => {
  const queryClient = useQueryClient()
  const { desktop } = useCapabilities()
  const { data: slicers = [] } = useSlicersQuery()
  const { data: prefs } = usePreferencesQuery()

  const open = async (models: Opened[], slicerId?: string | null) => {
    if (!desktop) {
      downloadSingle(models)
      return
    }
    if (!models.length) {
      return
    }
    const groups =
      slicerId === undefined
        ? groupBySlicer(models, prefs?.slicers, slicers)
        : new Map([[slicerId ?? undefined, models]])
    try {
      for (const [id, group] of groups) {
        await SystemApi.open(
          group.map((m) => m.path),
          id,
        )
      }
      toast(sentMessage(models, [...groups.keys()], slicers))
    } catch (error) {
      toastError(error)
    }
    // L'envoi est mémorisé côté back (vue « Envoyés au slicer »).
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.METAS })
  }

  return { open, desktop }
}
