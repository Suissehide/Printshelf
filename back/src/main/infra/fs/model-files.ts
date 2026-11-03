import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import { ARCHIVE_EXTENSIONS, withArchive } from './archive.ts'
import { bufferSource, listEntries, readEntry } from './zip-reader.ts'

export const MODEL_EXTENSIONS = [
  '3mf',
  'stl',
  'obj',
  'ply',
  'glb',
  'step',
  'stp',
  'gcode',
] as const
export type ModelExtension = (typeof MODEL_EXTENSIONS)[number]

// Séparateur entre le chemin d'une archive et celui d'une entrée : `pack.zip::dragon/tete.stl`.
export const ARCHIVE_SEPARATOR = '::'

export const extensionOf = (name: string): string =>
  path.extname(name).slice(1).toLowerCase()
export const isModel = (name: string): boolean =>
  (MODEL_EXTENSIONS as readonly string[]).includes(extensionOf(name))
export const isArchive = (name: string): boolean =>
  (ARCHIVE_EXTENSIONS as readonly string[]).includes(extensionOf(name))

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
export const readModel = (filePath: string): Promise<Buffer> => {
  const inArchive = splitArchivePath(filePath)
  if (!inArchive) {
    return fs.readFile(filePath)
  }
  return withArchive(inArchive.archive, (archive) =>
    archive.read(inArchive.entry),
  )
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

// Miniature d'un G-code : PrusaSlicer, Bambu Studio et Orca l'écrivent en tête, en commentaires
// base64 (« ; thumbnail begin 300x300 12345 » … « ; thumbnail end »). On garde la plus grande.
export const gcodeThumbnail = (head: Buffer): Buffer | undefined => {
  let best: { width: number; png: Buffer } | undefined
  for (const [, width, body] of head
    .toString('latin1')
    .matchAll(
      /; thumbnail begin (\d+)x\d+ \d+\r?\n([\s\S]*?); thumbnail end/g,
    )) {
    if (!best || Number(width) > best.width) {
      best = {
        width: Number(width),
        png: Buffer.from(
          body.replace(/^;\s?/gm, '').replace(/\s/g, ''),
          'base64',
        ),
      }
    }
  }
  return best?.png
}

// Premiers octets d'un fichier (sur le disque ou dans une archive).
export const readHead = async (filePath: string, bytes: number) => {
  if (splitArchivePath(filePath)) {
    return (await readModel(filePath)).subarray(0, bytes)
  }
  const handle = await fs.open(filePath, 'r')
  try {
    const buffer = Buffer.alloc(bytes)
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}
