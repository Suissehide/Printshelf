import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'

import { LibraryApi } from '../api/library.api.ts'
import { QUERY_KEYS } from '../constants/query-keys.ts'
import { toastError } from '../hooks/useToast.ts'
import type { Model, PrintInfo } from '../types/library.ts'
import { useCollectionsQuery, useMetasQuery } from './useOrganizer.ts'

// * QUERIES

export const useSourcesQuery = () =>
  useQuery({ queryKey: QUERY_KEYS.SOURCES, queryFn: LibraryApi.getSources })

export const useFilesQuery = () =>
  useQuery({ queryKey: QUERY_KEYS.FILES, queryFn: LibraryApi.getFiles })

// Le scan tourne en arrière-plan côté back : on le suit de près pendant qu'il tourne, et on
// recharge l'index des fichiers à la fin de chaque passage.
export const useScanQuery = () => {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: QUERY_KEYS.SCAN,
    queryFn: LibraryApi.getScan,
    refetchInterval: (q) =>
      q.state.data?.running || q.state.data?.measuring ? 800 : 10_000,
  })
  const lastFinished = useRef<number | null | undefined>(undefined)
  const finishedAt = query.data?.lastFinishedAt
  useEffect(() => {
    if (
      lastFinished.current !== undefined &&
      finishedAt !== lastFinished.current
    ) {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FILES })
    }
    lastFinished.current = finishedAt
  }, [finishedAt, queryClient])
  // Les dimensions arrivent au fil de la mesure en tâche de fond.
  const measuring = query.data?.measuring
  useEffect(() => {
    if (measuring !== undefined) {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DIMENSIONS })
    }
  }, [measuring, queryClient])
  return query
}

// Fichiers de l'index joints aux métadonnées et collections (synchronisées, rattachées au hash).
export const useDimensionsQuery = () =>
  useQuery({
    queryKey: QUERY_KEYS.DIMENSIONS,
    queryFn: LibraryApi.getDimensions,
  })

export const useModels = (): { models: Model[]; isPending: boolean } => {
  const files = useFilesQuery()
  const dimensions = useDimensionsQuery()
  const metas = useMetasQuery()
  const collections = useCollectionsQuery()

  const models = useMemo(() => {
    const metaByHash = new Map((metas.data ?? []).map((m) => [m.hash, m]))
    const dimsByHash = new Map(
      (dimensions.data ?? []).map(({ hash, ...d }) => [hash, d]),
    )
    const collectionsByHash = new Map<string, string[]>()
    for (const c of collections.data ?? []) {
      for (const h of c.hashes) {
        collectionsByHash.set(h, [...(collectionsByHash.get(h) ?? []), c.id])
      }
    }
    const copies = new Map<string, number>()
    for (const f of files.data ?? []) {
      copies.set(f.hash, (copies.get(f.hash) ?? 0) + 1)
    }
    return (files.data ?? []).map((f) => {
      const meta = metaByHash.get(f.hash)
      return {
        ...f,
        tags: meta?.tags ?? [],
        notes: meta?.notes ?? '',
        favorite: meta?.favorite ?? false,
        collectionIds: collectionsByHash.get(f.hash) ?? [],
        copies: copies.get(f.hash) ?? 1,
        sentAt: meta?.sentAt ?? null,
        dims: dimsByHash.get(f.hash) ?? null,
      }
    })
  }, [files.data, metas.data, collections.data, dimensions.data])

  return { models, isPending: files.isPending }
}

// Rendus, notices et readme rangés à côté du modèle.
export const useCompanionsQuery = (path: string) =>
  useQuery({
    queryKey: [...QUERY_KEYS.COMPANIONS, path],
    queryFn: () => LibraryApi.getCompanions(path),
    enabled: !!path,
  })

// Plateaux, filaments, temps et poids enregistrés par le slicer (3MF uniquement). Le contenu d'un
// fichier ne change pas sans changer de hash : la donnée ne se périme jamais.
const printInfoQuery = (
  model: Pick<Model, 'path' | 'hash' | 'ext'> | undefined,
) => ({
  queryKey: [...QUERY_KEYS.PRINT_INFO, model?.hash],
  queryFn: () => LibraryApi.getPrintInfo(model?.path ?? ''),
  enabled: model?.ext === '3mf',
  staleTime: Number.POSITIVE_INFINITY,
})

export const usePrintInfoQuery = (model: Model | undefined) =>
  useQuery(printInfoQuery(model))

export const usePrintInfos = (
  models: (Model | undefined)[],
): (PrintInfo | undefined)[] =>
  useQueries({ queries: models.map(printInfoQuery) }).map((q) => q.data)

// * MUTATIONS

export const useSourceMutations = () => {
  const queryClient = useQueryClient()
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SOURCES })
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SCAN })
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FILES })
  }
  return {
    addSource: useMutation({
      mutationFn: LibraryApi.addSource,
      onSuccess: refresh,
      onError: toastError,
    }),
    removeSource: useMutation({
      mutationFn: LibraryApi.removeSource,
      onSuccess: refresh,
      onError: toastError,
    }),
    startScan: useMutation({
      mutationFn: LibraryApi.startScan,
      onSuccess: refresh,
      onError: toastError,
    }),
  }
}
