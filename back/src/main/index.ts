import { config } from './application/config.ts'
import { buildContainer } from './application/container.ts'
import { buildHttpServer } from './interfaces/http/fastify/fastify-http-server.ts'

const container = buildContainer(config)
const server = buildHttpServer(container)

await server.listen({ port: config.PORT, host: config.HOST })
container.logger.info(
  { host: config.HOST, desktop: config.DESKTOP },
  `Printshelf : http://localhost:${config.PORT}`,
)
container.syncDomain.start()
container.libraryDomain.startScan()
container.libraryDomain.watchSources()
const purged = await container.libraryDomain.purgeDuplicateThumbnailsOnce()
if (purged) {
  container.logger.info({ purged }, 'Miniatures suspectes supprimées')
}
