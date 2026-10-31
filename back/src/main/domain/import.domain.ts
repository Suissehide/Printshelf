import fs from 'node:fs/promises'
import path from 'node:path'
import Boom from '@hapi/boom'

import { hashFile, isArchive, isModel, sha1 } from '../infra/fs/model-files.ts'
import { fileSource, readEntry, withZip } from '../infra/fs/zip-reader.ts'
import type { FileRepository } from '../infra/repositories/file.repository.ts'
import type { Logger } from '../utils/logger.ts'
import type { LibraryDomain } from './library.domain.ts'
import type { OrganizerDomain } from './organizer.domain.ts'

// IMPORT DEPUIS LE NAVIGATEUR (extension « Enregistrer dans Printshelf »)
//
// L'extension signale un téléchargement terminé (chemin local du fichier) avec ce qu'elle a lu sur
// la page du modèle. Printshelf COPIE le fichier — l'original reste dans Téléchargements, rien
// n'est jamais déplacé ni supprimé — dans un sous-dossier du dossier d'import, avec la couverture
// et un LISEZMOI.txt qui deviennent des fichiers joints, puis renseigne créateur et lien d'origine
// (synchronisés) sans écraser ce que l'utilisateur aurait déjà saisi.

export type ImportRequest = {
  path: string
  pageUrl: string
  title?: string
  creator?: string
  imageUrl?: string
  description?: string
}

export type ImportResult = { folder: string; file: string; models: number }

const IMPORT_FOLDER_NAME = 'Importés Printshelf'
const IMAGE_MAX_BYTES = 10 * 1024 * 1024
const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

// Nom de dossier sûr sur Mac, Windows et Linux.
export const safeName = (value: string, fallback = 'Modèle') =>
  value
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[ .]+|[ .]+$/g, '')
    .slice(0, 100) || fallback

const exists = (p: string) =>
  fs.stat(p).then(
    () => true,
    () => false,
  )

// Chemin libre : « nom.stl », sinon « nom (2).stl », « nom (3).stl »…
const freePath = async (dir: string, name: string) => {
  const ext = path.extname(name)
  const base = name.slice(0, name.length - ext.length)
  let candidate = path.join(dir, name)
  for (let n = 2; await exists(candidate); n++) {
    candidate = path.join(dir, `${base} (${n})${ext}`)
  }
  return candidate
}

export class ImportDomain {
  readonly #files: FileRepository
  readonly #library: LibraryDomain
  readonly #organizer: OrganizerDomain
  readonly #logger: Logger
  readonly #fetch: typeof fetch

  constructor({
    fileRepository,
    libraryDomain,
    organizerDomain,
    logger,
    fetchImpl = fetch,
  }: {
    fileRepository: FileRepository
    libraryDomain: LibraryDomain
    organizerDomain: OrganizerDomain
    logger: Logger
    fetchImpl?: typeof fetch
  }) {
    this.#files = fileRepository
    this.#library = libraryDomain
    this.#organizer = organizerDomain
    this.#logger = logger
    this.#fetch = fetchImpl
  }

  // Dossier d'import : celui choisi dans les réglages, sinon « Importés Printshelf » dans la
  // première source. Il est ajouté aux sources s'il n'en fait pas déjà partie.
  getFolder(): string | null {
    const chosen = this.#files.getSetting('import_folder')
    if (chosen) {
      return chosen
    }
    const first = this.#library.listSources()[0]
    return first ? path.join(first.path, IMPORT_FOLDER_NAME) : null
  }

  async setFolder(folder: string | null): Promise<string | null> {
    if (folder) {
      const resolved = path.resolve(folder.trim())
      await fs.mkdir(resolved, { recursive: true })
      this.#files.setSetting('import_folder', resolved)
    } else {
      this.#files.setSetting('import_folder', '')
    }
    return this.getFolder()
  }

  async import(request: ImportRequest): Promise<ImportResult> {
    const source = path.resolve(request.path)
    if (
      !path.isAbsolute(request.path) ||
      !(isModel(source) || isArchive(source))
    ) {
      throw Boom.badRequest(
        'Seuls les modèles 3D et les archives ZIP sont importés',
      )
    }
    const stat = await fs.stat(source).catch(() => null)
    if (!stat?.isFile()) {
      throw Boom.badRequest('Fichier téléchargé introuvable')
    }
    const root = this.getFolder()
    if (!root) {
      throw Boom.badRequest(
        'Ajoutez d’abord une source, ou choisissez un dossier d’import',
      )
    }

    const site = new URL(request.pageUrl).hostname.replace(/^www\./, '')
    const title =
      request.title?.trim() || path.basename(source, path.extname(source))
    const folder = path.join(root, safeName(`${title} — ${site}`))
    await fs.mkdir(folder, { recursive: true })
    const target = await this.#copyOnce(source, folder)

    await this.#writeReadme(folder, request, title)
    if (request.imageUrl) {
      await this.#saveCover(folder, request.imageUrl).catch((error) =>
        this.#logger.warn({ error: String(error) }, 'Couverture non récupérée'),
      )
    }

    const hashes = await this.#modelHashes(target)
    for (const hash of hashes) {
      this.#organizer.fillMeta(hash, {
        creator: request.creator?.trim() ?? '',
        sourceUrl: request.pageUrl,
      })
    }

    await this.#ensureSource(root)
    return { folder, file: target, models: hashes.length }
  }

  // Un même téléchargement importé deux fois n'est pas dupliqué.
  async #copyOnce(source: string, folder: string): Promise<string> {
    const sameName = path.join(folder, path.basename(source))
    if (
      (await exists(sameName)) &&
      (await hashFile(sameName)) === (await hashFile(source))
    ) {
      return sameName
    }
    const target = await freePath(folder, path.basename(source))
    await fs.copyFile(source, target)
    return target
  }

  async #writeReadme(folder: string, request: ImportRequest, title: string) {
    const lines = [
      title,
      request.creator ? `Créateur : ${request.creator}` : null,
      `Source : ${request.pageUrl}`,
      request.description ? `\n${request.description.trim()}` : null,
    ].filter((l): l is string => l !== null)
    await fs.writeFile(
      path.join(folder, 'LISEZMOI.txt'),
      `${lines.join('\n')}\n`,
    )
  }

  async #saveCover(folder: string, imageUrl: string) {
    const url = new URL(imageUrl)
    if (url.protocol !== 'https:') {
      throw new Error('Image hors https ignorée')
    }
    const response = await this.#fetch(url, {
      signal: AbortSignal.timeout(15_000),
      redirect: 'follow',
    })
    const type =
      response.headers.get('content-type')?.split(';')[0].trim() ?? ''
    const ext = IMAGE_TYPES[type]
    const size = Number(response.headers.get('content-length') ?? 0)
    if (!(response.ok && ext) || size > IMAGE_MAX_BYTES) {
      throw new Error(`Image refusée (${response.status} ${type})`)
    }
    const data = Buffer.from(await response.arrayBuffer())
    if (data.length > IMAGE_MAX_BYTES) {
      throw new Error('Image trop lourde')
    }
    await fs.writeFile(path.join(folder, `couverture.${ext}`), data)
  }

  // Hash de chaque modèle importé : le fichier lui-même, ou chaque modèle d'une archive.
  async #modelHashes(file: string): Promise<string[]> {
    if (isModel(file)) {
      return [await hashFile(file)]
    }
    return withZip(await fileSource(file), async (entries, zip) => {
      const hashes: string[] = []
      for (const entry of entries.filter(
        (e) => isModel(e.name) && !e.name.startsWith('__MACOSX/'),
      )) {
        hashes.push(sha1(await readEntry(zip, entry)))
      }
      return hashes
    })
  }

  async #ensureSource(root: string) {
    const inside = this.#library
      .listSources()
      .find((s) => root === s.path || root.startsWith(s.path + path.sep))
    if (inside) {
      this.#library.startScan([inside.id])
    } else {
      await this.#library.addSource(root)
    }
  }
}
