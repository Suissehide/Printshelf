import { CircleAlert, Info } from 'lucide-react'

import { useToasts } from '@/hooks/useToast.ts'
import { cn } from '@/utils/cn.ts'

export const Toaster = () => {
  const toasts = useToasts()
  return (
    <div
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex max-w-sm items-start gap-2.5 rounded-xl border bg-overlay px-3.5 py-2.5 shadow-(--shadow-pop)',
            t.tone === 'error' ? 'border-danger/40' : 'border-line',
          )}
        >
          {t.tone === 'error' ? (
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
          ) : (
            <Info className="mt-0.5 size-4 shrink-0 text-accent" />
          )}
          <span className="text-ink">{t.message}</span>
        </div>
      ))}
    </div>
  )
}
