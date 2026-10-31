import fs from 'node:fs'
import fastifyStatic from '@fastify/static'
import Boom from '@hapi/boom'
import Fastify, { type FastifyInstance } from 'fastify'
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'

import type { Container } from '../../../application/container.ts'
import { registerGuards } from './plugins/guard.plugin.ts'
import { libraryRouter } from './routes/library.router.ts'
import { organizerRouter } from './routes/organizer.router.ts'
import { systemRouter } from './routes/system.router.ts'

declare module 'fastify' {
  export interface FastifyInstance {
    container: Container
  }
}

export const buildHttpServer = (container: Container): FastifyInstance => {
  const fastify = Fastify({ bodyLimit: 50 * 1024 * 1024 })
  fastify.setValidatorCompiler(validatorCompiler)
  fastify.setSerializerCompiler(serializerCompiler)
  fastify.decorate('container', container)

  fastify.addContentTypeParser(
    'image/png',
    { parseAs: 'buffer' },
    (_request, body, done) => done(null, body),
  )

  registerGuards(fastify, container.config)

  fastify.setErrorHandler((error, _request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply
        .code(400)
        .send({ message: 'Requête invalide', issues: error.validation })
    }
    const boom = Boom.isBoom(error)
      ? error
      : Boom.boomify(error as Error, {
          statusCode: (error as { statusCode?: number }).statusCode ?? 500,
        })
    if (boom.output.statusCode >= 500) {
      container.logger.error({ error: String(error) }, 'Erreur serveur')
    }
    return reply
      .code(boom.output.statusCode)
      .headers(boom.output.headers)
      .send({ message: boom.message })
  })

  fastify.get('/api/health', () => ({ status: 'ok' }))
  fastify.register(libraryRouter, { prefix: '/api' })
  fastify.register(organizerRouter, { prefix: '/api' })
  fastify.register(systemRouter, { prefix: '/api' })

  // En usage normal, l'API sert aussi le front construit : une seule adresse à ouvrir.
  const frontDist = container.config.FRONT_DIST
  if (fs.existsSync(frontDist)) {
    fastify.register(fastifyStatic, { root: frontDist })
    fastify.setNotFoundHandler((request, reply) =>
      request.url.startsWith('/api/')
        ? reply.code(404).send({ message: 'Route inconnue' })
        : reply.sendFile('index.html'),
    )
  }

  return fastify
}
