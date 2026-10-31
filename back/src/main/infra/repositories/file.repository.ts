import type { DatabaseSync } from 'node:sqlite'

import { inTransaction } from '../db/sqlite-client.ts'
import type { About } from '../fs/model-about.ts'

export type Source = { id: number; path: string; created_at: string }

export type FileRow = {
  path: string
  source_id: number
  name: string
  dir: string
  ext: string
  size: number
  mtime: number
  hash: string
  archive: string | null
}

// Tables propres à cette machine : dossiers suivis et index des fichiers trouvés.
export class FileRepository {
  readonly #db: DatabaseSync

  constructor(db: DatabaseSync) {
    this.#db = db
  }

  listSources(): Source[] {
    return this.#db
      .prepare('SELECT * FROM source ORDER BY path')
      .all() as Source[]
  }

  addSource(path: string): Source {
    this.#db.prepare('INSERT OR IGNORE INTO source (path) VALUES (?)').run(path)
    return this.#db
      .prepare('SELECT * FROM source WHERE path = ?')
      .get(path) as Source
  }

  removeSource(id: number): void {
    this.#db.prepare('DELETE FROM source WHERE id = ?').run(id)
  }

  listFiles(): FileRow[] {
    return this.#db.prepare('SELECT * FROM file').all() as FileRow[]
  }

  hasHash(hash: string): boolean {
    return !!this.#db
      .prepare('SELECT 1 FROM file WHERE hash = ? LIMIT 1')
      .get(hash)
  }

  findFile(path: string): FileRow | undefined {
    return this.#db.prepare('SELECT * FROM file WHERE path = ?').get(path) as
      | FileRow
      | undefined
  }

  replaceSourceFiles(sourceId: number, files: FileRow[]): void {
    inTransaction(this.#db, () => {
      this.#db.prepare('DELETE FROM file WHERE source_id = ?').run(sourceId)
      const insert = this.#db.prepare(
        'INSERT OR REPLACE INTO file (path, source_id, name, dir, ext, size, mtime, hash, archive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      for (const f of files) {
        insert.run(
          f.path,
          f.source_id,
          f.name,
          f.dir,
          f.ext,
          f.size,
          f.mtime,
          f.hash,
          f.archive,
        )
      }
    })
  }

  // * DIMENSIONS (une ligne par contenu ; x à NULL = mesure impossible, à ne pas retenter)

  listDimensions(): { hash: string; x: number; y: number; z: number }[] {
    return this.#db
      .prepare('SELECT hash, x, y, z FROM model_dims WHERE x IS NOT NULL')
      .all() as { hash: string; x: number; y: number; z: number }[]
  }

  // Un chemin par contenu encore jamais analysé (dimensions ou « à propos »).
  unanalyzed(): (Pick<FileRow, 'hash' | 'path' | 'ext' | 'size'> & {
    measured: number
    described: number
  })[] {
    return this.#db
      .prepare(
        `SELECT hash, MIN(path) AS path, ext, size,
           hash IN (SELECT hash FROM model_dims) AS measured,
           hash IN (SELECT hash FROM model_about) AS described
         FROM file
         WHERE hash NOT IN (SELECT hash FROM model_dims) OR hash NOT IN (SELECT hash FROM model_about)
         GROUP BY hash`,
      )
      .all() as (Pick<FileRow, 'hash' | 'path' | 'ext' | 'size'> & {
      measured: number
      described: number
    })[]
  }

  // * À PROPOS (créateur, source…) lus dans les fichiers

  listAbout(): ({ hash: string } & About)[] {
    return this.#db
      .prepare(
        'SELECT * FROM model_about WHERE title IS NOT NULL OR designer IS NOT NULL OR description IS NOT NULL OR license IS NOT NULL OR origin IS NOT NULL',
      )
      .all() as ({ hash: string } & About)[]
  }

  setAbout(hash: string, about: About): void {
    this.#db
      .prepare(
        'INSERT OR REPLACE INTO model_about (hash, title, designer, description, license, origin) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        hash,
        about.title,
        about.designer,
        about.description,
        about.license,
        about.origin,
      )
  }

  setDimensions(
    hash: string,
    dims: { x: number; y: number; z: number } | null,
  ): void {
    this.#db
      .prepare(
        'INSERT OR REPLACE INTO model_dims (hash, x, y, z) VALUES (?, ?, ?, ?)',
      )
      .run(hash, dims?.x ?? null, dims?.y ?? null, dims?.z ?? null)
  }

  getSetting(key: string): string | undefined {
    const row = this.#db
      .prepare('SELECT value FROM setting WHERE key = ?')
      .get(key) as { value: string } | undefined
    return row?.value
  }

  setSetting(key: string, value: string): void {
    this.#db
      .prepare('INSERT OR REPLACE INTO setting (key, value) VALUES (?, ?)')
      .run(key, value)
  }
}
