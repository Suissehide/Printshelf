import { Clock, Layers, Printer, Weight } from 'lucide-react'
import { useState } from 'react'

import { LibraryApi } from '@/api/library.api.ts'
import type { PlateInfo, PrintInfo } from '@/types/library.ts'
import { cn } from '@/utils/cn.ts'
import { formatDuration, formatGrams } from '@/utils/format.ts'

const PlateThumbnail = ({ path, index }: { path: string; index: number }) => {
  const [failed, setFailed] = useState(false)
  return failed ? (
    <div className="thumb-stage size-12 shrink-0 rounded-md" />
  ) : (
    <img
      src={LibraryApi.plateThumbnailUrl(path, index)}
      alt=""
      onError={() => setFailed(true)}
      className="thumb-stage size-12 shrink-0 rounded-md object-contain"
    />
  )
}

const plateSummary = (plate: PlateInfo) =>
  plate.seconds === null
    ? 'non tranché'
    : [
        formatDuration(plate.seconds),
        plate.grams !== null && formatGrams(plate.grams),
      ]
        .filter(Boolean)
        .join(' · ')

// Ce que le slicer a enregistré : imprimante, filaments, plateaux (et, si le projet a été tranché,
// durée et poids). Un clic sur un plateau ne montre que lui dans la visionneuse.
export const PrintPanel = ({
  path,
  info,
  plate,
  onPlate,
}: {
  path: string
  info: PrintInfo
  plate: number | null
  onPlate: (plate: number | null) => void
}) => {
  const sliced = info.plates.filter((p) => p.seconds !== null)
  const totalSeconds = sliced.reduce((s, p) => s + (p.seconds ?? 0), 0)
  const totalGrams = sliced.reduce((s, p) => s + (p.grams ?? 0), 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-soft">
        {info.printer && (
          <span className="inline-flex items-center gap-1.5">
            <Printer className="size-3.5 text-ink-mute" /> {info.printer}
          </span>
        )}
        {info.layerHeight && (
          <span className="inline-flex items-center gap-1.5">
            <Layers className="size-3.5 text-ink-mute" /> {info.layerHeight} mm
          </span>
        )}
        {sliced.length > 0 && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5 text-ink-mute" />{' '}
              {formatDuration(totalSeconds)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Weight className="size-3.5 text-ink-mute" />{' '}
              {formatGrams(totalGrams)}
            </span>
          </>
        )}
      </div>

      {info.filaments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {info.filaments.map((f, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: l'ordre des filaments EST leur identité (extrudeur n°)
              key={i}
              className="inline-flex h-6 items-center gap-1.5 rounded-md border border-line bg-surface pr-2 pl-1.5 text-xs"
            >
              <span
                className="size-3 rounded-full border border-white/15"
                style={{ background: f.color }}
              />
              <span className="font-mono text-[10.5px] text-ink-mute">
                {i + 1}
              </span>
              {f.type}
            </span>
          ))}
        </div>
      )}

      {info.plates.length > 1 && (
        <ul className="flex flex-col gap-1">
          <li>
            <button
              type="button"
              onClick={() => onPlate(null)}
              className={cn(
                'w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-ink-soft hover:bg-raised',
                plate === null && 'bg-raised text-ink',
              )}
            >
              Tous les plateaux ({info.plates.length})
            </button>
          </li>
          {info.plates.map((p) => (
            <li key={p.index}>
              <button
                type="button"
                aria-pressed={plate === p.index}
                onClick={() => onPlate(p.index)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border border-transparent p-1.5 text-left hover:bg-raised',
                  plate === p.index && 'border-accent/50 bg-accent-soft',
                )}
              >
                <PlateThumbnail path={path} index={p.index} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    Plateau {p.index}
                    {p.name && (
                      <span className="font-normal text-ink-soft">
                        {' '}
                        · {p.name}
                      </span>
                    )}
                  </span>
                  <span className="block font-mono text-[11px] text-ink-mute">
                    {plateSummary(p)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {info.plates.length === 1 && (
        <p className="font-mono text-xs text-ink-mute">
          {plateSummary(info.plates[0])}
        </p>
      )}
    </div>
  )
}
