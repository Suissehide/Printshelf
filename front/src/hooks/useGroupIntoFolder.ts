import { useMutation, useQueryClient } from '@tanstack/react-query'

import { SystemApi } from '../api/system.api.ts'
import { formDialog } from '../components/ui/dialog.tsx'
import { QUERY_KEYS } from '../constants/query-keys.ts'
import { commonName } from '../libs/library/groups.ts'
import type { Model } from '../types/library.ts'
import { plural } from '../utils/format.ts'
import { toast, toastError } from './useToast.ts'

// Ranger des fichiers dans un nouveau dossier, à côté d'eux : demande le nom, déplace sur le disque
// (app de bureau), puis recharge l'index. Renvoie les déplacements, ou null si annulé.
export const useGroupIntoFolder = () => {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ paths, name }: { paths: string[]; name: string }) =>
      SystemApi.groupIntoFolder(paths, name),
    onError: toastError,
  })

  return async (models: Model[], suggested = commonName(models)) => {
    const values = await formDialog(
      `Ranger ${plural(models.length, 'fichier')} dans un dossier`,
      [
        {
          name: 'name',
          label: 'Nom du dossier',
          required: true,
          maxLength: 100,
          defaultValue: suggested,
        },
      ],
      {
        message:
          'Le dossier est créé à côté des fichiers, qui y sont déplacés. Rien n’est écrasé ni supprimé.',
        confirmLabel: 'Ranger',
      },
    )
    if (!values?.name) {
      return null
    }
    const result = await mutation
      .mutateAsync({ paths: models.map((m) => m.path), name: values.name })
      .catch(() => null)
    if (result) {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FILES })
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SCAN })
      toast(
        `${plural(result.moved.length, 'fichier rangé', 'fichiers rangés')} dans « ${values.name} »`,
      )
    }
    return result
  }
}
