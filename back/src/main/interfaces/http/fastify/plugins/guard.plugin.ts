import { createHash, timingSafeEqual } from 'node:crypto'
import Boom from '@hapi/boom'
import type { FastifyInstance } from 'fastify'

import type { Config } from '../../../../application/config.ts'

// Garde-fous appliqués à TOUTES les requêtes, avant le routage :
// 1. L'en-tête Host doit être la machine locale ou un hôte déclaré (ALLOWED_HOSTS) : bloque le
//    DNS rebinding, par lequel une page web quelconque viserait l'API locale.
// 2. Les écritures exigent un Content-Type JSON ou PNG, qu'un autre site ne peut pas envoyer sans
//    préflight CORS (jamais accordé ici) : bloque les formulaires/requêtes « simples » piégés.
// 3. Si AUTH_PASSWORD est défini (obligatoire hors de la boucle locale, voir `config.ts`),
//    authentification HTTP Basic ; à ne servir que derrière HTTPS (Traefik dans `deploy/`).

const LOCAL_NAMES = ['localhost', '127.0.0.1', '[::1]']
const WRITE_TYPES = /^(application\/json|image\/png)\b/
const PUBLIC_PATHS = ['/api/health']

const digest = (value: string) => createHash('sha256').update(value).digest()
const sameSecret = (a: string, b: string) =>
  timingSafeEqual(digest(a), digest(b))

const isAuthorized = (header: string | undefined, expected: string) => {
  const [scheme, encoded] = (header ?? '').split(' ')
  const given =
    scheme === 'Basic' && encoded
      ? Buffer.from(encoded, 'base64').toString('utf8')
      : ''
  return sameSecret(given, expected)
}

export const hostName = (host: string | undefined) =>
  (host ?? '').toLowerCase().replace(/:\d+$/, '')

export const registerGuards = (fastify: FastifyInstance, config: Config) => {
  const allowedHosts = new Set([...LOCAL_NAMES, ...config.ALLOWED_HOSTS])
  const expected = config.AUTH_PASSWORD
    ? `${config.AUTH_USER}:${config.AUTH_PASSWORD}`
    : null

  fastify.addHook('onRequest', (request, _reply, done) => {
    if (!allowedHosts.has(hostName(request.headers.host))) {
      return done(Boom.forbidden('Hôte non autorisé'))
    }
    const writes = ['POST', 'PUT', 'PATCH'].includes(request.method)
    if (
      writes &&
      request.headers['content-length'] !== '0' &&
      !WRITE_TYPES.test(request.headers['content-type'] ?? '')
    ) {
      return done(Boom.unsupportedMediaType('JSON attendu'))
    }
    const needsAuth = expected && !PUBLIC_PATHS.includes(request.url)
    if (needsAuth && !isAuthorized(request.headers.authorization, expected)) {
      return done(
        Boom.unauthorized('Authentification requise', 'Basic', {
          realm: 'Printshelf',
          charset: 'UTF-8',
        }),
      )
    }
    done()
  })
}
