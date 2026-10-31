import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import {
  bufferSource,
  fileSource,
  listEntries,
  readEntry,
  withZip,
} from './zip-reader.ts'

export const MODEL_EXTENSIONS = ['3mf', 'stl', 'obj', 'ply', 'glb'] as const
export type ModelExtension = (typeof MODEL_EXTENSIONS)[number]

// Séparateur entre le chemin d'une archive et celui d'une entrée : `pack.zip::dragon/tete.stl`.
export const ARCHIVE_SEPARATOR = '::'

export const extensionOf = (name: string): string =>
  path.extname(name).slice(1).toLowerCase()
export const isModel = (name: string): boolean =>
  (MODEL_EXTENSIONS as readonly string[]).includes(extensionOf(name))
export const isArchive = (name: string): boolean => extensionOf(name) === 'zip'

export const splitArchivePath = (
  filePath: string,
): { archive: string; entry: string } | null => {
  const index = filePath.indexOf(ARCHIVE_SEPARATOR)
  return index === -1
    ? null
    : {
        archive: filePath.slice(0, index),
        entry: filePath.slice(index + ARCHIVE_SEPARATOR.length),
      }
}

export const sha1 = (data: Buffer): string =>
  createHash('sha1').update(data).digest('hex')

export const hashFile = (filePath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = createHash('sha1')
    createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject)
  })

export async function* walk(dir: string): AsyncGenerator<string> {
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return // dossier illisible ou disparu pendant le scan
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === '__MACOSX') {
      continue
    }
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(full)
    } else if (
      entry.isFile() &&
      (isModel(entry.name) || isArchive(entry.name))
    ) {
      yield full
    }
  }
}

// Contenu d'un modèle, qu'il soit sur le disque ou dans une archive.
export const readModel = async (filePath: string): Promise<Buffer> => {
  const inArchive = splitArchivePath(filePath)
  if (!inArchive) {
    return fs.readFile(filePath)
  }
  return withZip(await fileSource(inArchive.archive), (entries, source) => {
    const entry = entries.find((e) => e.name === inArchive.entry)
    if (!entry) {
      throw new Error('Entrée introuvable dans l’archive')
    }
    return readEntry(source, entry)
  })
}

// Miniature enregistrée par le slicer dans un 3MF (Bambu/Orca : plate_1.png, Prusa : thumbnail.png).
export const embeddedThumbnail = async (
  data: Buffer,
): Promise<Buffer | undefined> => {
  const source = bufferSource(data)
  const pngs = (await listEntries(source)).filter(
    (e) =>
      /^Metadata\/.*\.png$/i.test(e.name) &&
      !/pick|top_|no_light|small/i.test(e.name),
  )
  const pick =
    pngs.find((e) => /plate_1\.png$/i.test(e.name)) ??
    pngs.find((e) => /thumbnail/i.test(e.name)) ??
    pngs[0]
  return pick ? readEntry(source, pick) : undefined
}
