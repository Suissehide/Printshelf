import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/utils/cn.ts'

// Option d'un groupe de choix exclusifs (formats, vues de la visionneuse) : le conteneur reste
// à l'appelant, qui peut y mêler d'autres boutons.
export const Segment = ({
  active,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) => (
  <button
    type="button"
    aria-pressed={active}
    className={cn(
      'h-7 rounded-md px-2.5 text-ink-mute transition-colors hover:text-ink aria-pressed:bg-raised aria-pressed:text-ink',
      className,
    )}
    {...props}
  />
)
