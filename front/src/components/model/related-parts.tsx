import { Link, useNavigate } from '@tanstack/react-router'
import { FolderInput } from 'lucide-react'
import { useMemo } from 'react'

import { Button } from '@/components/ui/button.tsx'
import { useGroupIntoFolder } from '@/hooks/useGroupIntoFolder.ts'
import { relatedParts } from '@/libs/library/groups.ts'
import { useCapabilities } from '@/queries/useSystem.ts'
import type { Model } from '@/types/library.ts'
import { cn } from '@/utils/cn.ts'

// Pièces voisines au nom commun (« repose_casque_base », « repose_casque_bras »…), proposées pour
// être rangées ensemble dans un dossier. Seulement dans l'app de bureau : sur un serveur, les
// fichiers sont en lecture seule.
export const RelatedParts = ({
  model,
  models,
}: {
  model: Model
  models: Model[]
}) => {
  const { desktop } = useCapabilities()
  const navigate = useNavigate()
  const groupIntoFolder = useGroupIntoFolder()
  const group = useMemo(() => relatedParts(model, models), [model, models])
  if (!(desktop && group)) {
    return null
  }

  const tidy = async () => {
    const result = await groupIntoFolder(group.models, group.name)
    const self = result?.moved.find((m) => m.from === model.path)
    if (self) {
      void navigate({ to: '/modele', search: { path: self.to }, replace: true })
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[10.5px] font-semibold tracking-[0.12em] text-ink-mute uppercase">
        Pièces liées
      </h3>
      <ul className="flex flex-col gap-0.5 text-xs">
        {group.models.map((m) => (
          <li key={m.path}>
            <Link
              to="/modele"
              search={{ path: m.path }}
              className={cn(
                'block truncate rounded-md px-2 py-1 hover:bg-raised',
                m.path === model.path ? 'text-ink' : 'text-ink-soft',
              )}
            >
              {m.name}
            </Link>
          </li>
        ))}
      </ul>
      <Button size="sm" className="self-start" onClick={tidy}>
        <FolderInput /> Ranger les {group.models.length} dans « {group.name} »
      </Button>
    </section>
  )
}
