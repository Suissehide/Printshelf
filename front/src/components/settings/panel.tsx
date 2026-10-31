import type { ReactNode } from 'react'

// Section de la page Réglages : titre et explication à gauche, contenu à droite.
export const Panel = ({
  title,
  description,
  children,
}: {
  title: string
  description: ReactNode
  children: ReactNode
}) => (
  <section className="grid gap-5 border-b border-line py-7 md:grid-cols-[260px_1fr]">
    <div>
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-ink-mute">{description}</p>
    </div>
    <div className="flex min-w-0 flex-col gap-3">{children}</div>
  </section>
)

export const fieldClass =
  'h-8.5 min-w-0 rounded-lg border border-line bg-surface px-2.5 text-ink outline-none placeholder:text-ink-mute focus:border-accent/60'
