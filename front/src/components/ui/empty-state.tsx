import type { ReactNode } from 'react'

export const EmptyState = ({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children?: ReactNode
}) => (
  <div className="flex flex-col items-center justify-center gap-3 px-6 py-24 text-center">
    <div className="grid size-14 place-items-center rounded-2xl border border-line bg-surface text-accent [&_svg]:size-6">
      {icon}
    </div>
    <h2 className="text-base font-semibold text-ink">{title}</h2>
    {children && <div className="max-w-md text-ink-mute">{children}</div>}
  </div>
)
