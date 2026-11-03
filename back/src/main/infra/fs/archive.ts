import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { fileSource, readEntry, withZip } from './zip-reader.ts'

// Archives parcourues comme des dossiers : ZIP lu directement (par plages, sans tout charger),
// RAR et 7z extraits dans un dossier temporaire par `bsdtar`, livré avec macOS et Windows 10+
// (`tar`). Sous Linux : paquet libarchive-tools.
// ponytail: un RAR/7z est extrait en entier à chaque accès (scan, visionneuse, fichiers joints) ;
// un cache d'extraction si de gros packs RAR rendent l'ouverture lente.

export const ARCHIVE_EXTENSIONS = ['zip', 'rar', '7z'] as const

export type ArchiveEntry = { name: string; size: number }
export type Archive = {
  entries: ArchiveEntry[]
  read: (name: string) => Promise<Buffer>
}

const exec = promisify(execFile)
const TAR = process.platform === 'linux' ? 'bsdtar' : 'tar'

const missing = (name: string) => {
  throw new Error(`Entrée introuvable dans l’archive : ${name}`)
}

async function* filesUnder(dir: string, prefix = ''): AsyncGenerator<string> {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const name = prefix + entry.name
    if (entry.isDirectory()) {
      yield* filesUnder(path.join(dir, entry.name), `${name}/`)
    } else if (entry.isFile()) {
      yield name // liens symboliques ignorés : rien ne sort du dossier extrait
    }
  }
}

const withExtracted = async <T>(
  filePath: string,
  fn: (archive: Archive) => Promise<T>,
): Promise<T> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'printshelf-'))
  try {
    // bsdtar refuse par défaut les chemins absolus et les « .. » : rien n'est écrit hors de `dir`.
    await exec(TAR, ['-xf', filePath, '-C', dir], { timeout: 5 * 60_000 })
    const entries: ArchiveEntry[] = []
    for await (const name of filesUnder(dir)) {
      const { size } = await fs.stat(path.join(dir, name))
      entries.push({ name, size })
    }
    const names = new Set(entries.map((e) => e.name))
    return await fn({
      entries,
      read: (name) =>
        names.has(name)
          ? fs.readFile(path.join(dir, ...name.split('/')))
          : missing(name),
    })
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

export const withArchive = async <T>(
  filePath: string,
  fn: (archive: Archive) => Promise<T>,
): Promise<T> => {
  if (path.extname(filePath).toLowerCase() !== '.zip') {
    return withExtracted(filePath, fn)
  }
  return withZip(await fileSource(filePath), (entries, source) =>
    fn({
      entries,
      read: (name) => {
        const entry = entries.find((e) => e.name === name)
        return entry ? readEntry(source, entry) : missing(name)
      },
    }),
  )
}
