import { ImportDomain } from '../domain/import.domain.ts'
import { LibraryDomain } from '../domain/library.domain.ts'
import {
  type CollectionModelRow,
  type CollectionRow,
  type ModelMetaRow,
  OrganizerDomain,
  type PreferenceRow,
  type QueueItemRow,
} from '../domain/organizer.domain.ts'
import { SyncDomain } from '../domain/sync.domain.ts'
import { createSqliteClient } from '../infra/db/sqlite-client.ts'
import { FileRepository } from '../infra/repositories/file.repository.ts'
import {
  SyncedRepository,
  type SyncedRow,
} from '../infra/repositories/synced.repository.ts'
import { logger } from '../utils/logger.ts'
import type { Config } from './config.ts'

// SEUL point d'assemblage de l'application (même rôle que le conteneur Awilix de MediSync,
// sans la bibliothèque : une dizaine d'objets se câblent à la main sans détour).
// `fetchImpl` : remplaçable dans les tests (téléchargement des couvertures).
export const buildContainer = (
  config: Config,
  { fetchImpl = fetch }: { fetchImpl?: typeof fetch } = {},
) => {
  const db = createSqliteClient(config.DATA_DIR)
  const fileRepository = new FileRepository(db)

  // Les dépôts synchronisés signalent chaque écriture ; la synchro est créée juste après eux.
  let sync: SyncDomain | undefined
  const onChange = () => sync?.scheduleExport()
  const modelMetaRepository = new SyncedRepository<ModelMetaRow>(
    db,
    'model_meta',
    [
      'tags',
      'notes',
      'favorite',
      'sent_at',
      'sent_count',
      'creator',
      'source_url',
    ],
    onChange,
  )
  const collectionRepository = new SyncedRepository<CollectionRow>(
    db,
    'collection',
    ['name', 'color'],
    onChange,
  )
  const collectionModelRepository = new SyncedRepository<CollectionModelRow>(
    db,
    'collection_model',
    ['collection_id', 'hash'],
    onChange,
  )
  const queueItemRepository = new SyncedRepository<QueueItemRow>(
    db,
    'queue_item',
    ['hash', 'name', 'status', 'quantity', 'created_at'],
    onChange,
  )

  const preferenceRepository = new SyncedRepository<PreferenceRow>(
    db,
    'preference',
    ['value'],
    onChange,
  )

  const syncDomain = new SyncDomain({
    fileRepository,
    logger,
    syncedRepositories: {
      model_meta: modelMetaRepository,
      collection: collectionRepository,
      collection_model: collectionModelRepository,
      queue_item: queueItemRepository,
      preference: preferenceRepository,
    } as Record<string, SyncedRepository<SyncedRow>>,
  })
  sync = syncDomain

  const libraryDomain = new LibraryDomain({
    fileRepository,
    dataDir: config.DATA_DIR,
    sourcesRoot: config.SOURCES_ROOT,
    logger,
  })
  const organizerDomain = new OrganizerDomain({
    modelMetaRepository,
    collectionRepository,
    collectionModelRepository,
    queueItemRepository,
    preferenceRepository,
  })

  return {
    config,
    logger,
    syncDomain,
    libraryDomain,
    organizerDomain,
    importDomain: new ImportDomain({
      fileRepository,
      libraryDomain,
      organizerDomain,
      logger,
      fetchImpl,
    }),
  }
}

export type Container = ReturnType<typeof buildContainer>
