import type { ReactNode } from 'react'

export const PageHeader = ({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}) => (
  <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-6 pt-6 pb-5">
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
      {subtitle && <p className="mt-1 text-ink-mute">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </header>
)
