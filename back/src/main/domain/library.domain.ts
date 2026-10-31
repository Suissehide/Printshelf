import { type FSWatcher, watch } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import Boom from '@hapi/boom'

import {
  archiveCompanions,
  CONTENT_TYPES,
  type Companion,
  companionKind,
  diskCompanions,
} from '../infra/fs/companions.ts'
import { measureModel } from '../infra/fs/dimensions.ts'
import {
  type About,
  aboutFrom3mf,
  detectSource,
  EMPTY_ABOUT,
  mergeAbout,
} from '../infra/fs/model-about.ts'
import {
  ARCHIVE_SEPARATOR,
  embeddedThumbnail,
  extensionOf,
  hashFile,
  isArchive,
  isModel,
  readModel,
  sha1,
  splitArchivePath,
  walk,
} from '../infra/fs/model-files.ts'
import {
  EMPTY_PRINT_INFO,
  type PrintInfo,
  readPrintInfo,
} from '../infra/fs/print-info.ts'
import {
  bufferSource,
  fileSource,
  readEntry,
  withZip,
} from '../infra/fs/zip-reader.ts'
import type {
  FileRepository,
  FileRow,
  Source,
} from '../infra/repositories/file.repository.ts'
import type { Logger } from '../utils/logger.ts'

export type ScanStatus = {
  running: boolean
  // Modèles restant à mesurer (dimensions), en arrière-plan après chaque scan.
  measuring: number
  processed: number
  current: string | null
  lastFinishedAt: number | null
  errors: number
}

const HASH_PATTERN = /^[0-9a-f]{40}$/
// Fichiers hachés en parallèle : assez pour masquer la latence d'un disque réseau (NAS),
// pas assez pour saturer un disque local.
const SCAN_CONCURRENCY = 4
// Un téléchargement ou une décompression produit une rafale d'événements : on attend le calme.
const WATCH_DEBOUNCE_MS = 2_500

const runPool = async <T>(
  items: T[],
  size: number,
  task: (item: T) => Promise<void>,
) => {
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      await task(items[next++])
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, worker),
  )
}

export class LibraryDomain {
  readonly #files: FileRepository
  readonly #thumbsDir: string
  readonly #extractDir: string
  readonly #logger: Logger
  readonly #sourcesRoot: string | undefined
  #status: ScanStatus = {
    running: false,
    measuring: 0,
    processed: 0,
    current: null,
    lastFinishedAt: null,
    errors: 0,
  }
  // Sources à rescanner au prochain passage ; `null` = toutes.
  #pending: Set<number> | null = new Set()
  readonly #watchers = new Map<number, FSWatcher>()
  #watchTimer: NodeJS.Timeout | undefined
  #watchedChanges = new Set<number>()

  constructor({
    fileRepository,
    dataDir,
    sourcesRoot,
    logger,
  }: {
    fileRepository: FileRepository
    dataDir: string
    sourcesRoot?: string
    logger: Logger
  }) {
    this.#sourcesRoot = sourcesRoot && path.resolve(sourcesRoot)
    this.#files = fileRepository
    this.#thumbsDir = path.join(dataDir, 'thumbs')
    this.#extractDir = path.join(dataDir, 'extracted')
    this.#logger = logger
  }

  // * SOURCES

  listSources(): Source[] {
    return this.#files.listSources()
  }

  async addSource(dir: string): Promise<Source> {
    const resolved = path.resolve(dir.trim())
    if (
      this.#sourcesRoot &&
      resolved !== this.#sourcesRoot &&
      !resolved.startsWith(this.#sourcesRoot + path.sep)
    ) {
      throw Boom.badRequest(
        `Les sources doivent se trouver sous ${this.#sourcesRoot}`,
      )
    }
    const stat = await fs.stat(resolved).catch(() => null)
    if (!stat?.isDirectory()) {
      throw Boom.badRequest(`« ${resolved} » n'est pas un dossier accessible`)
    }
    const source = this.#files.addSource(resolved)
    this.startScan([source.id])
    this.watchSources()
    return source
  }

  removeSource(id: number): void {
    // L'index seul est vidé (cascade sur `file`) ; aucun fichier n'est touché sur le disque.
    this.#files.removeSource(id)
    this.watchSources()
  }

  // * SURVEILLANCE

  // Un modèle ajouté, renommé ou supprimé dans une source déclenche le rescan de CETTE source.
  // `recursive` est pris en charge nativement sur macOS, Windows et Linux (Node 20+).
  // ponytail: un disque réseau (SMB/NFS) ne remonte pas toujours ses événements ; « Rescanner »
  // reste alors le recours.
  watchSources(): void {
    const sources = this.#files.listSources()
    for (const [id, watcher] of this.#watchers) {
      if (!sources.some((s) => s.id === id)) {
        watcher.close()
        this.#watchers.delete(id)
      }
    }
    for (const source of sources.filter((s) => !this.#watchers.has(s.id))) {
      try {
        const watcher = watch(
          source.path,
          { recursive: true },
          (_event, name) => {
            if (name && (isModel(name) || isArchive(name))) {
              this.#onWatchedChange(source.id)
            }
          },
        )
        watcher.on('error', (error) => {
          this.#logger.warn(
            { path: source.path, error: String(error) },
            'Surveillance interrompue',
          )
          watcher.close()
          this.#watchers.delete(source.id)
        })
        this.#watchers.set(source.id, watcher)
      } catch (error) {
        this.#logger.warn(
          { path: source.path, error: String(error) },
          'Dossier non surveillable',
        )
      }
    }
  }

  #onWatchedChange(sourceId: number): void {
    this.#watchedChanges.add(sourceId)
    clearTimeout(this.#watchTimer)
    this.#watchTimer = setTimeout(() => {
      const ids = [...this.#watchedChanges]
      this.#watchedChanges.clear()
      this.startScan(ids)
    }, WATCH_DEBOUNCE_MS)
  }

  stopWatching(): void {
    clearTimeout(this.#watchTimer)
    for (const watcher of this.#watchers.values()) {
      watcher.close()
    }
    this.#watchers.clear()
  }

  // * SCAN

  get scanStatus(): ScanStatus {
    return this.#status
  }

  // Lance le scan en arrière-plan et rend la main tout de suite ; le front suit `scanStatus`.
  // Sans argument : toutes les sources. Un scan demandé pendant un autre est fusionné au suivant.
  startScan(sourceIds?: number[]): void {
    if (!sourceIds) {
      this.#pending = null
    } else if (this.#pending) {
      for (const id of sourceIds) {
        this.#pending.add(id)
      }
    }
    if (this.#status.running) {
      return
    }
    const targets = this.#pending
    this.#pending = new Set()
    this.#status = { ...this.#status, running: true, processed: 0, errors: 0 }
    void this.#scan(targets)
      .catch((error) => this.#logger.error({ error }, 'Scan interrompu'))
      .finally(() => {
        this.#status = {
          ...this.#status,
          running: false,
          current: null,
          lastFinishedAt: Date.now(),
        }
        if (this.#pending === null || this.#pending.size) {
          this.startScan(this.#pending ? [...this.#pending] : undefined)
        } else {
          void this.#measureMissing()
        }
      })
  }

  // * DIMENSIONS

  listDimensions() {
    return this.#files.listDimensions()
  }

  #measuringNow = false

  listAbout() {
    return this.#files.listAbout()
  }

  // Analyse, un par un et en tâche de fond, les contenus jamais analysés : dimensions, puis
  // « à propos » (créateur, source…) lu dans le 3MF et dans les readme du pack. Le résultat (même
  // « rien trouvé ») est mémorisé par hash : chaque contenu n'est lu qu'une fois.
  // ponytail: au-delà de 300 Mo le fichier n'est pas chargé en mémoire pour être analysé.
  async #measureMissing(): Promise<void> {
    if (this.#measuringNow) {
      return
    }
    this.#measuringNow = true
    try {
      const todo = this.#files.unanalyzed()
      this.#status = { ...this.#status, measuring: todo.length }
      for (const file of todo) {
        if (this.#status.running) {
          break // un scan a repris : il relancera l'analyse à la fin
        }
        const data =
          file.size > 300_000_000
            ? null
            : await readModel(file.path).catch(() => null)
        if (!file.measured) {
          const dims = data
            ? await Promise.resolve(measureModel(file.ext, data)).catch(
                () => null,
              )
            : null
          this.#files.setDimensions(file.hash, dims)
        }
        if (!file.described) {
          this.#files.setAbout(file.hash, await this.#describe(file, data))
        }
        this.#status = {
          ...this.#status,
          measuring: this.#status.measuring - 1,
        }
      }
    } finally {
      this.#measuringNow = false
      this.#status = { ...this.#status, measuring: 0 }
    }
  }

  async #describe(
    file: { path: string; ext: string },
    data: Buffer | null,
  ): Promise<About> {
    const fromModel =
      data && file.ext === '3mf'
        ? await aboutFrom3mf(data).catch(() => EMPTY_ABOUT)
        : EMPTY_ABOUT
    const texts = await this.#companionTexts(file.path).catch(() => [])
    return mergeAbout(fromModel, detectSource(texts))
  }

  // Petits fichiers texte du pack (readme, LICENSE, attribution) : là où les sites notent la source.
  async #companionTexts(filePath: string): Promise<string[]> {
    const { list, read } = await this.#companions(filePath)
    const texts = list
      .filter((c) => c.kind === 'text' && c.size <= 64_000)
      .slice(0, 5)
    return Promise.all(
      texts.map(async (c) => (await read(c.name)).toString('utf8')),
    )
  }

  async #scan(only: Set<number> | null): Promise<void> {
    const previous = this.#files.listFiles()
    const known = new Map(previous.map((f) => [f.path, f]))
    const byArchive = Map.groupBy(
      previous.filter((f) => f.archive),
      (f) => f.archive as string,
    )
    const sources = this.#files
      .listSources()
      .filter((s) => !only || only.has(s.id))
    for (const source of sources) {
      const paths: string[] = []
      for await (const filePath of walk(source.path)) {
        paths.push(filePath)
      }
      const rows: FileRow[] = []
      await runPool(paths, SCAN_CONCURRENCY, async (filePath) => {
        this.#status.current = filePath
        try {
          rows.push(
            ...(await this.#indexFile(source.id, filePath, known, byArchive)),
          )
        } catch (error) {
          this.#status.errors++
          this.#logger.warn(
            { filePath, error: String(error) },
            'Fichier ignoré',
          )
        }
        this.#status.processed++
      })
      this.#files.replaceSourceFiles(source.id, rows)
    }
  }

  async #indexFile(
    sourceId: number,
    filePath: string,
    known: Map<string, FileRow>,
    byArchive: Map<string, FileRow[]>,
  ): Promise<FileRow[]> {
    const stat = await fs.stat(filePath)
    const unchanged = (row?: FileRow) =>
      row && row.size === stat.size && row.mtime === stat.mtimeMs
    const base = { source_id: sourceId, mtime: stat.mtimeMs }

    if (isModel(filePath)) {
      const previous = known.get(filePath)
      const hash =
        unchanged(previous) && previous
          ? previous.hash
          : await hashFile(filePath)
      return [
        {
          ...base,
          path: filePath,
          name: path.basename(filePath),
          dir: path.dirname(filePath),
          ext: extensionOf(filePath),
          size: stat.size,
          hash,
          archive: null,
        },
      ]
    }
    if (!isArchive(filePath)) {
      return []
    }

    // Archive inchangée : on reprend ses entrées déjà indexées sans la relire.
    const previousEntries = byArchive.get(filePath) ?? []
    if (
      previousEntries.length &&
      previousEntries.every((r) => r.mtime === stat.mtimeMs)
    ) {
      return previousEntries.map((r) => ({ ...r, source_id: sourceId }))
    }
    return withZip(await fileSource(filePath), async (entries, source) => {
      const rows: FileRow[] = []
      for (const entry of entries.filter(
        (e) => isModel(e.name) && !e.name.startsWith('__MACOSX/'),
      )) {
        const data = await readEntry(source, entry)
        rows.push({
          ...base,
          path: `${filePath}${ARCHIVE_SEPARATOR}${entry.name}`,
          name: path.posix.basename(entry.name),
          dir: path.join(filePath, path.posix.dirname(entry.name)),
          ext: extensionOf(entry.name),
          size: entry.size,
          hash: sha1(data),
          archive: filePath,
        })
      }
      return rows
    })
  }

  // * FICHIERS

  listFiles(): FileRow[] {
    return this.#files.listFiles()
  }

  getFile(filePath: string): FileRow {
    return this.#requireIndexed(filePath)
  }

  #requireIndexed(filePath: string): FileRow {
    const row = this.#files.findFile(filePath)
    if (!row) {
      throw Boom.notFound('Fichier absent de la bibliothèque')
    }
    return row
  }

  readContent(filePath: string): Promise<Buffer> {
    this.#requireIndexed(filePath)
    return readModel(filePath)
  }

  // Chemin réel à donner au slicer ou au Finder : une entrée d'archive est extraite à part,
  // l'archive elle-même n'est jamais modifiée.
  async materialize(filePath: string): Promise<string> {
    const row = this.#requireIndexed(filePath)
    if (!splitArchivePath(filePath)) {
      return filePath
    }
    const target = path.join(this.#extractDir, row.hash, row.name)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, await readModel(filePath))
    return target
  }

  // * FICHIERS D'ACCOMPAGNEMENT

  async listCompanions(filePath: string): Promise<Companion[]> {
    return (await this.#companions(filePath)).list
  }

  async readCompanion(
    filePath: string,
    name: string,
  ): Promise<{ data: Buffer; contentType: string }> {
    const { list, read } = await this.#companions(filePath)
    // Seul un nom de la liste calculée est servi : aucun chemin arbitraire ne passe.
    const companion = list.find((c) => c.name === name)
    const kind = companion && companionKind(companion.name)
    if (!(companion && kind)) {
      throw Boom.notFound('Fichier d’accompagnement introuvable')
    }
    return {
      data: await read(companion.name),
      contentType: CONTENT_TYPES[kind](
        path.extname(name).slice(1).toLowerCase(),
      ),
    }
  }

  async #companions(
    filePath: string,
  ): Promise<{ list: Companion[]; read: (name: string) => Promise<Buffer> }> {
    const row = this.#requireIndexed(filePath)
    const inArchive = splitArchivePath(filePath)
    if (inArchive) {
      return withZip(await fileSource(inArchive.archive), (entries) => {
        const { base, list } = archiveCompanions(entries, inArchive.entry)
        const read = async (name: string) =>
          withZip(await fileSource(inArchive.archive), (all, source) => {
            const entry = all.find((e) => e.name === base + name)
            if (!entry) {
              throw Boom.notFound('Entrée introuvable')
            }
            return readEntry(source, entry)
          })
        return Promise.resolve({ list, read })
      })
    }
    const source = this.#files.listSources().find((s) => s.id === row.source_id)
    const { base, list } = await diskCompanions(
      row.dir,
      source?.path ?? row.dir,
    )
    return {
      list,
      read: (name: string) => fs.readFile(path.join(base, ...name.split('/'))),
    }
  }

  // * INFOS D'IMPRESSION

  // ponytail: cache mémoire par hash, borné grossièrement ; un LRU si la mémoire devient un sujet.
  readonly #printInfo = new Map<string, PrintInfo>()

  async getPrintInfo(filePath: string): Promise<PrintInfo> {
    const row = this.#requireIndexed(filePath)
    if (row.ext !== '3mf') {
      return EMPTY_PRINT_INFO
    }
    const cached = this.#printInfo.get(row.hash)
    if (cached) {
      return cached
    }
    // Hors archive : lecture par plages (seuls les petits fichiers de réglages sont lus).
    const source = splitArchivePath(filePath)
      ? bufferSource(await readModel(filePath))
      : await fileSource(filePath)
    const info = await readPrintInfo(source)
      .catch(() => EMPTY_PRINT_INFO)
      .finally(() => source.close())
    if (this.#printInfo.size > 2000) {
      this.#printInfo.clear()
    }
    this.#printInfo.set(row.hash, info)
    return info
  }

  // Miniature d'un plateau précis, enregistrée par Bambu Studio / OrcaSlicer.
  async readPlateThumbnail(filePath: string, index: number): Promise<Buffer> {
    const row = this.#requireIndexed(filePath)
    if (row.ext !== '3mf') {
      throw Boom.notFound('Pas de plateau')
    }
    const source = splitArchivePath(filePath)
      ? bufferSource(await readModel(filePath))
      : await fileSource(filePath)
    return withZip(source, (entries, zip) => {
      const entry = entries.find(
        (e) => e.name.toLowerCase() === `metadata/plate_${index}.png`,
      )
      if (!entry) {
        throw Boom.notFound('Pas de miniature pour ce plateau')
      }
      return readEntry(zip, entry)
    })
  }

  // * MINIATURES

  async getThumbnail(hash: string, filePath?: string): Promise<Buffer | null> {
    if (!HASH_PATTERN.test(hash)) {
      throw Boom.badRequest('Empreinte invalide')
    }
    const cached = path.join(this.#thumbsDir, `${hash}.png`)
    const existing = await fs.readFile(cached).catch(() => null)
    if (existing) {
      return existing
    }
    const row = filePath ? this.#files.findFile(filePath) : undefined
    if (row?.hash !== hash || row.ext !== '3mf') {
      return null // le front la rendra en 3D puis l'enverra
    }
    const png = await embeddedThumbnail(await readModel(row.path)).catch(
      () => undefined,
    )
    if (!png) {
      return null
    }
    await this.#writeThumbnail(hash, png)
    return png
  }

  async putThumbnail(hash: string, png: Buffer): Promise<void> {
    if (!HASH_PATTERN.test(hash) || !this.#files.hasHash(hash)) {
      throw Boom.notFound('Modèle inconnu')
    }
    await this.#writeThumbnail(hash, png)
  }

  async #writeThumbnail(hash: string, png: Buffer): Promise<void> {
    await fs.mkdir(this.#thumbsDir, { recursive: true })
    await fs.writeFile(path.join(this.#thumbsDir, `${hash}.png`), png)
  }
}
