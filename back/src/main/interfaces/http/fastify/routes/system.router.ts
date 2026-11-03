import Boom from '@hapi/boom'
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

import {
  detectSlicers,
  openWith,
  pickFolder,
  reveal,
  type Slicer,
} from '../../../../infra/system/desktop.ts'
import {
  groupFolderBodySchema,
  groupFolderResultSchema,
  importBodySchema,
  importFolderSchema,
  importResultSchema,
  openBodySchema,
  revealBodySchema,
  setImportFolderBodySchema,
  setSyncFolderBodySchema,
  slicerSchema,
  syncStatusSchema,
} from '../schemas/system.schema.ts'

export const systemRouter: FastifyPluginCallbackZod = (
  fastify,
  _options,
  done,
) => {
  const { libraryDomain, organizerDomain, syncDomain, importDomain, config } =
    fastify.container
  let slicers: Promise<Slicer[]> = config.DESKTOP
    ? detectSlicers()
    : Promise.resolve([])

  // Ce que l'installation sait faire : le front adapte ses boutons (slicer/Finder ou Télécharger).
  fastify.get(
    '/system/capabilities',
    {
      schema: {
        response: {
          200: z.object({
            desktop: z.boolean(),
            sourcesRoot: z.string().nullable(),
          }),
        },
      },
    },
    () => ({
      desktop: config.DESKTOP,
      sourcesRoot: config.SOURCES_ROOT ?? null,
    }),
  )

  // * BUREAU (mode bureau uniquement : sur un serveur, ces actions s'exécuteraient côté serveur)

  fastify.addHook('onRequest', (request, _reply, done) => {
    const desktopOnly =
      /^\/api\/(system\/(pick-folder|slicers|open|reveal)|imports|organize)/.test(
        request.url,
      )
    done(
      desktopOnly && !config.DESKTOP
        ? Boom.notImplemented(
            'Action disponible uniquement dans l’app de bureau',
          )
        : undefined,
    )
  })

  // POST et non GET : ouvrir une fenêtre native est un effet de bord.
  fastify.post(
    '/system/pick-folder',
    { schema: { response: { 200: z.object({ path: z.string() }) } } },
    async () => ({
      path: await pickFolder(),
    }),
  )

  fastify.get(
    '/system/slicers',
    { schema: { response: { 200: z.array(slicerSchema) } } },
    async () => (await slicers).map(({ id, name }) => ({ id, name })),
  )

  fastify.post(
    '/system/slicers/refresh',
    { schema: { response: { 200: z.array(slicerSchema) } } },
    async () => {
      slicers = detectSlicers()
      return (await slicers).map(({ id, name }) => ({ id, name }))
    },
  )

  fastify.post(
    '/system/open',
    { schema: { body: openBodySchema } },
    async (request, reply) => {
      const slicer = request.body.slicerId
        ? (await slicers).find((s) => s.id === request.body.slicerId)
        : undefined
      if (request.body.slicerId && !slicer) {
        throw Boom.notFound('Slicer introuvable')
      }
      const paths = request.body.paths
      const files = await Promise.all(
        paths.map((p) => libraryDomain.materialize(p)),
      )
      openWith(files, slicer)
      organizerDomain.markSent(paths.map((p) => libraryDomain.getFile(p).hash))
      return reply.code(204).send()
    },
  )

  fastify.post(
    '/system/reveal',
    { schema: { body: revealBodySchema } },
    async (request, reply) => {
      reveal(await libraryDomain.materialize(request.body.path))
      return reply.code(204).send()
    },
  )

  // * SYNCHRONISATION ET SAUVEGARDE

  fastify.get(
    '/sync',
    { schema: { response: { 200: syncStatusSchema } } },
    () => syncDomain.status,
  )

  fastify.put(
    '/sync',
    {
      schema: {
        body: setSyncFolderBodySchema,
        response: { 200: syncStatusSchema },
      },
    },
    (request) => syncDomain.setFolder(request.body.folder),
  )

  fastify.post(
    '/sync/now',
    { schema: { response: { 200: syncStatusSchema } } },
    () => syncDomain.syncNow(),
  )

  fastify.get('/sync/backup', (_request, reply) => {
    const date = new Date().toISOString().slice(0, 10)
    return reply
      .header(
        'Content-Disposition',
        `attachment; filename="printshelf-sauvegarde-${date}.json"`,
      )
      .send(syncDomain.snapshot())
  })

  fastify.post(
    '/sync/restore',
    { schema: { response: { 200: z.object({ changed: z.number() }) } } },
    (request) => ({
      changed: syncDomain.restore(request.body),
    }),
  )

  // * IMPORT DEPUIS LE NAVIGATEUR (mode bureau : le fichier est sur cette machine)

  fastify.get(
    '/imports/folder',
    { schema: { response: { 200: importFolderSchema } } },
    () => ({
      folder: importDomain.getFolder(),
    }),
  )

  fastify.put(
    '/imports/folder',
    {
      schema: {
        body: setImportFolderBodySchema,
        response: { 200: importFolderSchema },
      },
    },
    async (request) => ({
      folder: await importDomain.setFolder(request.body.folder),
    }),
  )

  // Déplace des fichiers dans un nouveau dossier (sur un serveur, les modèles sont en lecture seule).
  fastify.post(
    '/organize/folder',
    {
      schema: {
        body: groupFolderBodySchema,
        response: { 200: groupFolderResultSchema },
      },
    },
    (request) =>
      libraryDomain.groupIntoFolder(request.body.paths, request.body.name),
  )

  fastify.post(
    '/imports',
    {
      schema: { body: importBodySchema, response: { 200: importResultSchema } },
    },
    (request) => importDomain.import(request.body),
  )

  done()
}
