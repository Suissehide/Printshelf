import { Link } from '@tanstack/react-router'
import { ExternalLink, FileText, Scale, User } from 'lucide-react'
import { useState } from 'react'

import { fieldClass } from '@/components/settings/panel.tsx'
import { useMetaMutation, useMetasQuery } from '@/queries/useOrganizer.ts'
import type { Model } from '@/types/library.ts'
import { cn } from '@/utils/cn.ts'

const SITES: [RegExp, string][] = [
  [/(^|\.)printables\.com$/, 'Printables'],
  [/(^|\.)makerworld\.com$/, 'MakerWorld'],
  [/(^|\.)thingiverse\.com$/, 'Thingiverse'],
  [/(^|\.)cults3d\.com$/, 'Cults3D'],
  [/(^|\.)myminifactory\.com$/, 'MyMiniFactory'],
]

// Nom lisible du site d'un lien, ou null si ce n'est pas un lien http(s) valide.
export const siteName = (url: string): string | null => {
  try {
    const { protocol, hostname } = new URL(url)
    if (protocol !== 'http:' && protocol !== 'https:') {
      return null
    }
    return (
      SITES.find(([pattern]) => pattern.test(hostname))?.[1] ??
      hostname.replace(/^www\./, '')
    )
  } catch {
    return null
  }
}

const FromFile = () => (
  <span className="text-[10.5px] text-ink-mute">lu dans le fichier</span>
)

type SourcePatch = { creator?: string; sourceUrl?: string }

const isChange = (patch: SourcePatch, saved?: SourcePatch | null) =>
  (patch.creator !== undefined && patch.creator !== (saved?.creator ?? '')) ||
  (patch.sourceUrl !== undefined &&
    patch.sourceUrl !== (saved?.sourceUrl ?? ''))

// Licence et description lues dans le fichier.
const AboutExtras = ({ about }: { about: NonNullable<Model['about']> }) => (
  <>
    {about.license && (
      <p className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
        <Scale className="size-3.5 text-ink-mute" /> Licence : {about.license}
      </p>
    )}
    {about.description && (
      <details className="group rounded-lg border border-line bg-surface px-3 py-2 text-xs">
        <summary className="flex cursor-pointer items-center gap-1.5 text-ink-soft select-none">
          <FileText className="size-3.5 text-ink-mute" /> Description du
          créateur
        </summary>
        <p className="mt-2 whitespace-pre-line text-ink-soft">
          {about.description}
        </p>
      </details>
    )}
  </>
)

// Créateur, lien d'origine, licence et description. Ce que l'utilisateur saisit (synchronisé)
// prime sur ce qui est lu dans le 3MF ou le readme du pack, affiché en indication.
// À monter avec `key={model.path}` : les brouillons repartent de zéro à chaque modèle.
export const SourcePanel = ({ model }: { model: Model }) => {
  const meta = useMetasQuery().data?.find((m) => m.hash === model.hash)
  const save = useMetaMutation()
  const [creator, setCreator] = useState(meta?.creator ?? '')
  const [url, setUrl] = useState(meta?.sourceUrl ?? '')
  const about = model.about
  const effectiveUrl = url.trim() || about?.origin || ''
  const site = effectiveUrl ? siteName(effectiveUrl) : null
  const urlInvalid = url.trim() !== '' && !siteName(url.trim())

  const commit = (patch: SourcePatch) => {
    if (isChange(patch, meta)) {
      save.mutate({ hash: model.hash, ...patch })
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      {about?.title && about.title !== model.name.replace(/\.[^.]+$/, '') && (
        <p className="font-medium text-ink">{about.title}</p>
      )}

      <label className="flex flex-col gap-1">
        <span className="flex items-center justify-between text-xs text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <User className="size-3.5 text-ink-mute" /> Créateur
          </span>
          {!creator.trim() && about?.designer && <FromFile />}
        </span>
        <input
          value={creator}
          onChange={(e) => setCreator(e.target.value)}
          onBlur={() => commit({ creator: creator.trim() })}
          placeholder={about?.designer ?? 'Qui a conçu ce modèle ?'}
          maxLength={120}
          className={fieldClass}
        />
      </label>
      {model.creator && (
        <Link
          to="/"
          search={{ q: model.creator }}
          className="-mt-1 text-xs text-accent hover:underline"
        >
          Tous les modèles de {model.creator}
        </Link>
      )}

      <label className="flex flex-col gap-1">
        <span className="flex items-center justify-between text-xs text-ink-soft">
          <span>Page d'origine</span>
          {!url.trim() && about?.origin && <FromFile />}
        </span>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={() => !urlInvalid && commit({ sourceUrl: url.trim() })}
          placeholder={about?.origin ?? 'https://www.printables.com/model/…'}
          maxLength={500}
          className={cn(fieldClass, urlInvalid && 'border-danger/60')}
        />
        {urlInvalid && (
          <span className="text-xs text-danger">Lien http(s) attendu</span>
        )}
      </label>
      {site && (
        <a
          href={effectiveUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex h-8 items-center gap-2 self-start rounded-lg border border-line bg-surface px-3 text-xs hover:border-accent/60"
        >
          <ExternalLink className="size-3.5 text-accent" /> Voir sur {site}
        </a>
      )}

      {about && <AboutExtras about={about} />}
    </div>
  )
}
