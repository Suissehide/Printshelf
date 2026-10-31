import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import {
  addQueueBodySchema,
  collectionModelsBodySchema,
  collectionSchema,
  createCollectionBodySchema,
  hashParamsSchema,
  idParamsSchema,
  modelMetaSchema,
  preferencesSchema,
  printersSchema,
  queueItemSchema,
  slicerPreferencesSchema,
  updateCollectionBodySchema,
  updateMetaBodySchema,
  updateQueueBodySchema,
} from '../schemas/organizer.schema.ts'

export const organizerRouter: FastifyPluginCallbackZod = (
  fastify,
  _options,
  done,
) => {
  const { organizerDomain } = fastify.container

  // * MÉTADONNÉES (tags, notes, favori)

  fastify.get(
    '/metas',
    { schema: { response: { 200: z.array(modelMetaSchema) } } },
    () => organizerDomain.listMetas(),
  )

  fastify.patch(
    '/metas/:hash',
    {
      schema: {
        params: hashParamsSchema,
        body: updateMetaBodySchema,
        response: { 200: modelMetaSchema },
      },
    },
    (request) => organizerDomain.updateMeta(request.params.hash, request.body),
  )

  // * COLLECTIONS

  fastify.get(
    '/collections',
    { schema: { response: { 200: z.array(collectionSchema) } } },
    () => organizerDomain.listCollections(),
  )

  fastify.post(
    '/collections',
    {
      schema: {
        body: createCollectionBodySchema,
        response: { 201: collectionSchema },
      },
    },
    (request, reply) => {
      reply.code(201)
      return organizerDomain.createCollection(
        request.body.name,
        request.body.color,
      )
    },
  )

  fastify.patch(
    '/collections/:id',
    { schema: { params: idParamsSchema, body: updateCollectionBodySchema } },
    (request, reply) => {
      organizerDomain.updateCollection(request.params.id, request.body)
      return reply.code(204).send()
    },
  )

  fastify.delete(
    '/collections/:id',
    { schema: { params: idParamsSchema } },
    (request, reply) => {
      organizerDomain.removeCollection(request.params.id)
      return reply.code(204).send()
    },
  )

  fastify.put(
    '/collections/:id/models',
    { schema: { params: idParamsSchema, body: collectionModelsBodySchema } },
    (request, reply) => {
      organizerDomain.setInCollection(
        request.params.id,
        request.body.hashes,
        request.body.included,
      )
      return reply.code(204).send()
    },
  )

  // * FILE D'IMPRESSION

  fastify.get(
    '/queue',
    { schema: { response: { 200: z.array(queueItemSchema) } } },
    () => organizerDomain.listQueue(),
  )

  fastify.post(
    '/queue',
    { schema: { body: addQueueBodySchema } },
    (request, reply) => {
      organizerDomain.addToQueue(
        request.body.hash,
        request.body.name,
        request.body.quantity,
      )
      return reply.code(204).send()
    },
  )

  fastify.patch(
    '/queue/:id',
    { schema: { params: idParamsSchema, body: updateQueueBodySchema } },
    (request, reply) => {
      organizerDomain.updateQueueItem(request.params.id, request.body)
      return reply.code(204).send()
    },
  )

  fastify.delete(
    '/queue/:id',
    { schema: { params: idParamsSchema } },
    (request, reply) => {
      organizerDomain.removeQueueItem(request.params.id)
      return reply.code(204).send()
    },
  )

  // * PRÉFÉRENCES

  // Relues avec validation : une valeur venue d'un fichier de synchro douteux retombe sur le défaut.
  const preferences = () => {
    const stored = organizerDomain.listPreferences()
    const slicers = slicerPreferencesSchema.safeParse(stored.slicers)
    const printers = printersSchema.safeParse(stored.printers)
    return {
      slicers: slicers.success
        ? slicers.data
        : { defaultSlicerId: null, tagRules: [] },
      printers: printers.success ? printers.data : [],
    }
  }

  fastify.get(
    '/preferences',
    { schema: { response: { 200: preferencesSchema } } },
    preferences,
  )

  fastify.put(
    '/preferences/slicers',
    {
      schema: {
        body: slicerPreferencesSchema,
        response: { 200: preferencesSchema },
      },
    },
    (request) => {
      organizerDomain.setPreference('slicers', request.body)
      return preferences()
    },
  )

  fastify.put(
    '/preferences/printers',
    { schema: { body: printersSchema, response: { 200: preferencesSchema } } },
    (request) => {
      organizerDomain.setPreference('printers', request.body)
      return preferences()
    },
  )

  done()
}
