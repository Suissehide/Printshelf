import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { SystemApi } from '../api/system.api.ts'
import { QUERY_KEYS, SYNCED_KEYS } from '../constants/query-keys.ts'
import { toast, toastError } from '../hooks/useToast.ts'

// App de bureau (slicer, Finder, sélecteur natif) ou installation serveur (téléchargement).
export const useCapabilities = () => {
  const { data } = useQuery({
    queryKey: QUERY_KEYS.CAPABILITIES,
    queryFn: SystemApi.getCapabilities,
    staleTime: Number.POSITIVE_INFINITY,
  })
  return data ?? { desktop: true, sourcesRoot: null }
}

export const useSlicersQuery = () => {
  const { desktop } = useCapabilities()
  return useQuery({
    queryKey: QUERY_KEYS.SLICERS,
    queryFn: SystemApi.getSlicers,
    staleTime: Number.POSITIVE_INFINITY,
    enabled: desktop,
  })
}

// Quand une autre machine a synchronisé (révision incrémentée côté back), on recharge
// tout ce qui est partagé.
export const useSyncQuery = () => {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: QUERY_KEYS.SYNC,
    queryFn: SystemApi.getSync,
    refetchInterval: 15_000,
  })
  const revision = query.data?.revision
  const seen = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (seen.current !== undefined && revision !== seen.current) {
      for (const queryKey of SYNCED_KEYS) {
        void queryClient.invalidateQueries({ queryKey })
      }
    }
    seen.current = revision
  }, [revision, queryClient])
  return query
}

export const useSystemActions = () => {
  const queryClient = useQueryClient()
  const syncChanged = () => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SYNC })
    for (const queryKey of SYNCED_KEYS) {
      void queryClient.invalidateQueries({ queryKey })
    }
  }
  return {
    reveal: useMutation({ mutationFn: SystemApi.reveal, onError: toastError }),
    refreshSlicers: useMutation({
      mutationFn: SystemApi.refreshSlicers,
      onSuccess: (slicers) =>
        queryClient.setQueryData(QUERY_KEYS.SLICERS, slicers),
      onError: toastError,
    }),
    setSyncFolder: useMutation({
      mutationFn: SystemApi.setSyncFolder,
      onSuccess: syncChanged,
      onError: toastError,
    }),
    syncNow: useMutation({
      mutationFn: SystemApi.syncNow,
      onSuccess: syncChanged,
      onError: toastError,
    }),
    restore: useMutation({
      mutationFn: SystemApi.restore,
      onSuccess: ({ changed }) => {
        toast(
          changed
            ? `${changed} élément(s) restauré(s)`
            : 'Rien à restaurer : tout est déjà à jour',
        )
        syncChanged()
      },
      onError: toastError,
    }),
  }
}

// Sélecteur de dossier natif ; renvoie '' si l'utilisateur annule.
export const pickFolder = async (): Promise<string> =>
  (await SystemApi.pickFolder()).path
