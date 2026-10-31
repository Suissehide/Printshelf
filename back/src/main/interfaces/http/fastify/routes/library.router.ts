import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import {
  aboutSchema,
  addSourceBodySchema,
  companionQuerySchema,
  companionSchema,
  dimensionsSchema,
  fileSchema,
  pathQuerySchema,
  plateThumbnailQuerySchema,
  printInfoSchema,
  scanStatusSchema,
  sourceIdParamsSchema,
  sourceSchema,
  thumbnailParamsSchema,
  thumbnailQuerySchema,
} from '../schemas/library.schema.ts'

export const libraryRouter: FastifyPluginCallbackZod = (
  fastify,
  _options,
  done,
) => {
  const { libraryDomain } = fastify.container

  // * SOURCES

  fastify.get(
    '/sources',
    { schema: { response: { 200: z.array(sourceSchema) } } },
    () => libraryDomain.listSources(),
  )

  fastify.post(
    '/sources',
    { schema: { body: addSourceBodySchema, response: { 201: sourceSchema } } },
    (request, reply) => {
      reply.code(201)
      return libraryDomain.addSource(request.body.path)
    },
  )

  fastify.delete(
    '/sources/:id',
    { schema: { params: sourceIdParamsSchema } },
    (request, reply) => {
      libraryDomain.removeSource(request.params.id)
      return reply.code(204).send()
    },
  )

  // * SCAN

  fastify.get(
    '/scan',
    { schema: { response: { 200: scanStatusSchema } } },
    () => libraryDomain.scanStatus,
  )

  fastify.post(
    '/scan',
    { schema: { response: { 202: scanStatusSchema } } },
    (_request, reply) => {
      libraryDomain.startScan()
      reply.code(202)
      return libraryDomain.scanStatus
    },
  )

  // * FICHIERS

  fastify.get(
    '/files',
    { schema: { response: { 200: z.array(fileSchema) } } },
    () => libraryDomain.listFiles(),
  )

  fastify.get(
    '/files/content',
    { schema: { querystring: pathQuerySchema } },
    async (request, reply) => {
      const content = await libraryDomain.readContent(request.query.path)
      return reply.type('application/octet-stream').send(content)
    },
  )

  fastify.get(
    '/files/download',
    { schema: { querystring: pathQuerySchema } },
    async (request, reply) => {
      const content = await libraryDomain.readContent(request.query.path)
      const name = request.query.path.split(/[\\/:]/).pop() ?? 'modele'
      return reply
        .type('application/octet-stream')
        .header(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        )
        .send(content)
    },
  )

  // * À CÔTÉ DU MODÈLE : fichiers d'accompagnement, infos d'impression, plateaux

  fastify.get(
    '/files/companions',
    {
      schema: {
        querystring: pathQuerySchema,
        response: { 200: z.array(companionSchema) },
      },
    },
    (request) => libraryDomain.listCompanions(request.query.path),
  )

  fastify.get(
    '/files/companion',
    { schema: { querystring: companionQuerySchema } },
    async (request, reply) => {
      const { data, contentType } = await libraryDomain.readCompanion(
        request.query.path,
        request.query.name,
      )
      return reply
        .type(contentType)
        .header('X-Content-Type-Options', 'nosniff')
        .header(
          'Content-Security-Policy',
          "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
        )
        .send(data)
    },
  )

  fastify.get(
    '/files/print-info',
    {
      schema: {
        querystring: pathQuerySchema,
        response: { 200: printInfoSchema },
      },
    },
    (request) => libraryDomain.getPrintInfo(request.query.path),
  )

  fastify.get(
    '/files/plate-thumbnail',
    { schema: { querystring: plateThumbnailQuerySchema } },
    async (request, reply) => {
      const png = await libraryDomain.readPlateThumbnail(
        request.query.path,
        request.query.index,
      )
      return reply.type('image/png').send(png)
    },
  )

  fastify.get(
    '/about',
    { schema: { response: { 200: z.array(aboutSchema) } } },
    () => libraryDomain.listAbout(),
  )

  fastify.get(
    '/dimensions',
    { schema: { response: { 200: z.array(dimensionsSchema) } } },
    () => libraryDomain.listDimensions(),
  )

  // * MINIATURES

  fastify.get(
    '/thumbnails/:hash',
    {
      schema: {
        params: thumbnailParamsSchema,
        querystring: thumbnailQuerySchema,
      },
    },
    async (request, reply) => {
      const png = await libraryDomain.getThumbnail(
        request.params.hash,
        request.query.path,
      )
      if (!png) {
        return reply.code(404).send({ message: 'Pas encore de miniature' })
      }
      return reply
        .type('image/png')
        .header('Cache-Control', 'no-cache')
        .send(png)
    },
  )

  fastify.put(
    '/thumbnails/:hash',
    { schema: { params: thumbnailParamsSchema } },
    async (request, reply) => {
      await libraryDomain.putThumbnail(
        request.params.hash,
        request.body as Buffer,
      )
      return reply.code(204).send()
    },
  )

  done()
}
