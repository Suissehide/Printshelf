import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { OrganizerApi } from '../api/organizer.api.ts'
import { QUERY_KEYS } from '../constants/query-keys.ts'
import { toast, toastError } from '../hooks/useToast.ts'
import type {
  ModelMeta,
  Preferences,
  Printer,
  QueueStatus,
  SlicerPreferences,
} from '../types/library.ts'

// * QUERIES

export const useMetasQuery = () =>
  useQuery({ queryKey: QUERY_KEYS.METAS, queryFn: OrganizerApi.getMetas })
export const useCollectionsQuery = () =>
  useQuery({
    queryKey: QUERY_KEYS.COLLECTIONS,
    queryFn: OrganizerApi.getCollections,
  })
export const useQueueQuery = () =>
  useQuery({ queryKey: QUERY_KEYS.QUEUE, queryFn: OrganizerApi.getQueue })

// Imprimantes et règles de slicer, synchronisées entre ordinateurs.
export const usePreferencesQuery = () =>
  useQuery({
    queryKey: QUERY_KEYS.PREFERENCES,
    queryFn: OrganizerApi.getPreferences,
  })

// * MUTATIONS

export const usePreferencesMutations = () => {
  const queryClient = useQueryClient()
  const onSuccess = (prefs: Preferences) =>
    queryClient.setQueryData(QUERY_KEYS.PREFERENCES, prefs)
  return {
    setSlicers: useMutation({
      mutationFn: (prefs: SlicerPreferences) =>
        OrganizerApi.setSlicerPreferences(prefs),
      onSuccess,
      onError: toastError,
    }),
    setPrinters: useMutation({
      mutationFn: (printers: Printer[]) => OrganizerApi.setPrinters(printers),
      onSuccess,
      onError: toastError,
    }),
  }
}

export const useMetaMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ hash, ...patch }: Partial<ModelMeta> & { hash: string }) =>
      OrganizerApi.updateMeta(hash, patch),
    // Mise à jour optimiste : un clic sur l'étoile doit répondre tout de suite.
    onMutate: async ({ hash, ...patch }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.METAS })
      const previous =
        queryClient.getQueryData<ModelMeta[]>(QUERY_KEYS.METAS) ?? []
      const current = previous.find((m) => m.hash === hash) ?? {
        hash,
        tags: [],
        notes: '',
        favorite: false,
      }
      queryClient.setQueryData(QUERY_KEYS.METAS, [
        ...previous.filter((m) => m.hash !== hash),
        { ...current, ...patch },
      ])
      return { previous }
    },
    onError: (error, _vars, context) => {
      queryClient.setQueryData(QUERY_KEYS.METAS, context?.previous)
      toastError(error)
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.METAS }),
  })
}

export const useCollectionMutations = () => {
  const queryClient = useQueryClient()
  const onSuccess = () =>
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COLLECTIONS })
  return {
    create: useMutation({
      mutationFn: ({ name, color }: { name: string; color: string }) =>
        OrganizerApi.createCollection(name, color),
      onSuccess,
      onError: toastError,
    }),
    update: useMutation({
      mutationFn: ({
        id,
        ...patch
      }: {
        id: string
        name?: string
        color?: string
      }) => OrganizerApi.updateCollection(id, patch),
      onSuccess,
      onError: toastError,
    }),
    remove: useMutation({
      mutationFn: OrganizerApi.removeCollection,
      onSuccess,
      onError: toastError,
    }),
    setModels: useMutation({
      mutationFn: ({
        id,
        hashes,
        included,
      }: {
        id: string
        hashes: string[]
        included: boolean
      }) => OrganizerApi.setInCollection(id, hashes, included),
      onSuccess,
      onError: toastError,
    }),
  }
}

export const useQueueMutations = () => {
  const queryClient = useQueryClient()
  const onSuccess = () =>
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.QUEUE })
  return {
    add: useMutation({
      mutationFn: ({ hash, name }: { hash: string; name: string }) =>
        OrganizerApi.addToQueue(hash, name),
      onSuccess: (_data, { name }) => {
        toast(`« ${name} » ajouté à la file d'impression`)
        return onSuccess()
      },
      onError: toastError,
    }),
    update: useMutation({
      mutationFn: ({
        id,
        ...patch
      }: {
        id: string
        status?: QueueStatus
        quantity?: number
      }) => OrganizerApi.updateQueueItem(id, patch),
      onSuccess,
      onError: toastError,
    }),
    remove: useMutation({
      mutationFn: OrganizerApi.removeQueueItem,
      onSuccess,
      onError: toastError,
    }),
  }
}
