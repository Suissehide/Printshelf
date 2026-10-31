import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import Boom from '@hapi/boom'
import { z } from 'zod'

import { SYNCED_TABLES, type SyncedTable } from '../infra/db/sqlite-client.ts'
import type { FileRepository } from '../infra/repositories/file.repository.ts'
import type {
  SyncedRepository,
  SyncedRow,
} from '../infra/repositories/synced.repository.ts'
import type { Logger } from '../utils/logger.ts'

// SYNCHRONISATION ENTRE ORDINATEURS, SANS SERVEUR
//
// L'utilisateur choisit un dossier déjà synchronisé par son cloud (iCloud Drive, Dropbox,
// OneDrive…). Chaque machine y écrit SON PROPRE fichier `printshelf-sync/<deviceId>.json` — jamais
// celui d'une autre : deux machines n'écrivent donc jamais le même fichier, et le client cloud n'a
// aucun conflit à résoudre. Chaque machine lit ensuite les fichiers des autres et fusionne ligne à
// ligne : la version la plus récente (`updated_at`) gagne, suppressions comprises (pierres tombales).
//
// ponytail: horodatage par l'horloge de chaque machine ; deux modifications de la même ligne à
// quelques secondes d'intervalle sur deux machines désynchronisées peuvent s'ordonner à l'envers.

const SYNC_FOLDER = 'printshelf-sync'
// Dossier d'avant le renommage du projet : encore LU, pour qu'une machine pas encore mise à jour
// continue de partager ses données. On n'y écrit plus.
const LEGACY_SYNC_FOLDER = 'meshory-sync'
const POLL_INTERVAL_MS = 20_000
const EXPORT_DEBOUNCE_MS = 1_500

const rowSchema = z.looseObject({
  id: z.string().min(1).max(200),
  updated_at: z.number().int().nonnegative(),
  deleted: z.union([z.literal(0), z.literal(1)]),
})
const syncFileSchema = z.object({
  version: z.literal(1),
  deviceId: z.string(),
  deviceName: z.string(),
  exportedAt: z.number(),
  tables: z.partialRecord(z.enum(SYNCED_TABLES), z.array(rowSchema)),
})
type SyncFile = z.infer<typeof syncFileSchema>

export type SyncStatus = {
  folder: string | null
  deviceId: string
  deviceName: string
  // Incrémenté à chaque import qui a changé quelque chose : le front s'en sert pour recharger.
  revision: number
  lastExportAt: number | null
  lastImportAt: number | null
  devices: { deviceId: string; deviceName: string; exportedAt: number }[]
  error: string | null
}

export class SyncDomain {
  readonly #files: FileRepository
  readonly #repositories: Record<SyncedTable, SyncedRepository<SyncedRow>>
  readonly #logger: Logger
  #exportTimer: NodeJS.Timeout | undefined
  #status: SyncStatus

  constructor({
    fileRepository,
    syncedRepositories,
    logger,
  }: {
    fileRepository: FileRepository
    syncedRepositories: Record<SyncedTable, SyncedRepository<SyncedRow>>
    logger: Logger
  }) {
    this.#files = fileRepository
    this.#repositories = syncedRepositories
    this.#logger = logger
    let deviceId = this.#files.getSetting('device_id')
    if (!deviceId) {
      deviceId = randomUUID()
      this.#files.setSetting('device_id', deviceId)
    }
    this.#status = {
      folder: this.#files.getSetting('sync_folder') ?? null,
      deviceId,
      deviceName: os.hostname(),
      revision: 0,
      lastExportAt: null,
      lastImportAt: null,
      devices: [],
      error: null,
    }
  }

  get status(): SyncStatus {
    return this.#status
  }

  start(): void {
    void this.syncNow()
    setInterval(() => void this.#importAll(), POLL_INTERVAL_MS).unref()
  }

  async setFolder(folder: string | null): Promise<SyncStatus> {
    if (folder) {
      const resolved = path.resolve(folder.trim())
      const stat = await fs.stat(resolved).catch(() => null)
      if (!stat?.isDirectory()) {
        throw Boom.badRequest(`« ${resolved} » n'est pas un dossier accessible`)
      }
      this.#files.setSetting('sync_folder', resolved)
      this.#status = {
        ...this.#status,
        folder: resolved,
        devices: [],
        error: null,
      }
    } else {
      this.#files.setSetting('sync_folder', '')
      this.#status = { ...this.#status, folder: null, devices: [], error: null }
    }
    await this.syncNow()
    return this.#status
  }

  // Appelé par les dépôts à chaque écriture locale.
  scheduleExport(): void {
    clearTimeout(this.#exportTimer)
    this.#exportTimer = setTimeout(
      () => void this.#export(),
      EXPORT_DEBOUNCE_MS,
    )
  }

  async syncNow(): Promise<SyncStatus> {
    await this.#importAll()
    await this.#export()
    return this.#status
  }

  #dir(): string | null {
    return this.#status.folder
      ? path.join(this.#status.folder, SYNC_FOLDER)
      : null
  }

  // Sauvegarde complète des données synchronisées : sert aussi d'export manuel.
  snapshot(): SyncFile {
    const tables: SyncFile['tables'] = {}
    for (const table of SYNCED_TABLES) {
      tables[table] = this.#repositories[
        table
      ].listWithTombstones() as SyncFile['tables'][SyncedTable]
    }
    return {
      version: 1,
      deviceId: this.#status.deviceId,
      deviceName: this.#status.deviceName,
      exportedAt: Date.now(),
      tables,
    }
  }

  restore(payload: unknown): number {
    const changed = this.#merge(syncFileSchema.parse(payload))
    if (changed) {
      this.#status = { ...this.#status, revision: this.#status.revision + 1 }
      this.scheduleExport()
    }
    return changed
  }

  async #export(): Promise<void> {
    const dir = this.#dir()
    if (!dir) {
      return
    }
    try {
      await fs.mkdir(dir, { recursive: true })
      const target = path.join(dir, `${this.#status.deviceId}.json`)
      // Écriture atomique : le client cloud ne voit jamais un fichier à moitié écrit.
      await fs.writeFile(`${target}.tmp`, JSON.stringify(this.snapshot()))
      await fs.rename(`${target}.tmp`, target)
      this.#status = { ...this.#status, lastExportAt: Date.now(), error: null }
    } catch (error) {
      this.#fail(error)
    }
  }

  async #importAll(): Promise<void> {
    const dir = this.#dir()
    if (!dir) {
      return
    }
    try {
      const legacyDir = path.join(path.dirname(dir), LEGACY_SYNC_FOLDER)
      const files: string[] = []
      for (const folder of [dir, legacyDir]) {
        const names = await fs.readdir(folder).catch(() => [])
        files.push(
          ...names
            .filter(
              (n) =>
                n.endsWith('.json') && n !== `${this.#status.deviceId}.json`,
            )
            .map((n) => path.join(folder, n)),
        )
      }
      const devices = new Map<string, SyncStatus['devices'][number]>()
      let changed = 0
      for (const name of files) {
        try {
          const file = syncFileSchema.parse(
            JSON.parse(await fs.readFile(name, 'utf8')),
          )
          // Une machine présente dans les deux dossiers n'apparaît qu'une fois (son envoi le plus récent).
          const known = devices.get(file.deviceId)
          if (!known || known.exportedAt < file.exportedAt) {
            devices.set(file.deviceId, {
              deviceId: file.deviceId,
              deviceName: file.deviceName,
              exportedAt: file.exportedAt,
            })
          }
          changed += this.#merge(file)
        } catch (error) {
          // Fichier en cours de téléchargement par le client cloud, ou corrompu : on réessaiera.
          this.#logger.warn(
            { name, error: String(error) },
            'Fichier de synchro ignoré',
          )
        }
      }
      this.#status = {
        ...this.#status,
        devices: [...devices.values()],
        lastImportAt: Date.now(),
        revision: this.#status.revision + (changed ? 1 : 0),
        error: null,
      }
      if (changed) {
        this.#logger.info({ changed }, 'Synchro : modifications reçues')
      }
    } catch (error) {
      this.#fail(error)
    }
  }

  #merge(file: SyncFile): number {
    let changed = 0
    for (const table of SYNCED_TABLES) {
      for (const row of file.tables[table] ?? []) {
        if (this.#repositories[table].merge(row as SyncedRow)) {
          changed++
        }
      }
    }
    return changed
  }

  #fail(error: unknown): void {
    this.#status = {
      ...this.#status,
      error: error instanceof Error ? error.message : String(error),
    }
    this.#logger.error({ error: String(error) }, 'Synchro en échec')
  }
}
