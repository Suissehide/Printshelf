import { Box } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { LibraryApi } from '@/api/library.api.ts'
import { requestThumbnail } from '@/libs/three/thumbnail-queue.ts'
import { cn } from '@/utils/cn.ts'

type State = 'loading' | 'ready' | 'failed'

// Miniature du cache du back (ou intégrée au 3MF) ; à défaut, rendue en 3D dans le navigateur.
export const Thumbnail = ({
  hash,
  path,
  ext,
  className,
}: {
  hash: string
  path: string
  ext: string
  className?: string
}) => {
  const [src, setSrc] = useState(() => LibraryApi.thumbnailUrl(hash, path))
  const [state, setState] = useState<State>('loading')
  const current = useRef(hash)
  current.current = hash

  useEffect(() => {
    setSrc(LibraryApi.thumbnailUrl(hash, path))
    setState('loading')
  }, [hash, path])

  // Un rendu raté (onglet en arrière-plan, contexte 3D perdu) se retente au retour sur l'onglet,
  // sans avoir à recharger la page.
  useEffect(() => {
    if (state !== 'failed') {
      return
    }
    const retry = () => {
      if (!document.hidden) {
        setSrc(LibraryApi.thumbnailUrl(hash, path))
        setState('loading')
      }
    }
    document.addEventListener('visibilitychange', retry)
    return () => document.removeEventListener('visibilitychange', retry)
  }, [state, hash, path])

  const onError = () => {
    if (src.startsWith('blob:')) {
      setState('failed')
      return
    }
    const requested = hash
    void requestThumbnail(hash, path, ext).then((url) => {
      if (current.current !== requested) {
        return // le composant affiche déjà un autre modèle
      }
      if (url) {
        setSrc(url)
      } else {
        setState('failed')
      }
    })
  }

  return (
    <div
      className={cn(
        'thumb-stage relative grid place-items-center overflow-hidden',
        className,
      )}
    >
      {state !== 'failed' && (
        <img
          src={src}
          alt=""
          loading="lazy"
          draggable={false}
          onLoad={() => setState('ready')}
          onError={onError}
          className={cn(
            'size-full object-contain p-[6%] transition-opacity duration-300',
            state === 'ready' ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
      {state !== 'ready' && (
        <Box
          className={cn(
            'absolute size-7 text-line-strong',
            state === 'loading' && 'animate-pulse',
          )}
          strokeWidth={1.25}
        />
      )}
    </div>
  )
}
