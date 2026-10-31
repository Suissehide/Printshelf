import type { DatabaseSync, SQLInputValue } from 'node:sqlite'

import type { SyncedTable } from '../db/sqlite-client.ts'

export type SyncedRow = {
  id: string
  updated_at: number
  deleted: number
} & Record<string, SQLInputValue>

// Un seul dépôt pour les quatre tables synchronisées : elles partagent la même mécanique
// (identifiant stable, horodatage, pierre tombale), seules leurs colonnes changent.
export class SyncedRepository<T extends SyncedRow> {
  readonly #db: DatabaseSync
  readonly #table: SyncedTable
  readonly #columns: string[]
  readonly #onChange: () => void

  // `columns` fait foi pour toute écriture : une ligne venue d'un fichier de synchro ne peut
  // donc pas glisser un nom de colonne de son choix dans la requête.
  constructor(
    db: DatabaseSync,
    table: SyncedTable,
    columns: string[],
    onChange: () => void,
  ) {
    this.#db = db
    this.#table = table
    this.#columns = ['id', ...columns, 'updated_at', 'deleted']
    this.#onChange = onChange
  }

  list(): T[] {
    return this.#db
      .prepare(`SELECT * FROM ${this.#table} WHERE deleted = 0`)
      .all() as T[]
  }

  listWithTombstones(): T[] {
    return this.#db.prepare(`SELECT * FROM ${this.#table}`).all() as T[]
  }

  get(id: string): T | undefined {
    return this.#db
      .prepare(`SELECT * FROM ${this.#table} WHERE id = ? AND deleted = 0`)
      .get(id) as T | undefined
  }

  // Écriture locale : horodatée maintenant, puis export vers le dossier de synchro.
  save(row: Omit<T, 'updated_at' | 'deleted'>): T {
    const saved = { ...row, updated_at: Date.now(), deleted: 0 } as T
    this.#write(saved)
    this.#onChange()
    return saved
  }

  remove(id: string): void {
    this.#db
      .prepare(
        `UPDATE ${this.#table} SET deleted = 1, updated_at = ? WHERE id = ?`,
      )
      .run(Date.now(), id)
    this.#onChange()
  }

  // Écriture venue d'une autre machine : appliquée seulement si elle est plus récente.
  merge(remote: T): boolean {
    const local = this.#db
      .prepare(`SELECT updated_at FROM ${this.#table} WHERE id = ?`)
      .get(remote.id) as { updated_at: number } | undefined
    if (local && local.updated_at >= remote.updated_at) {
      return false
    }
    this.#write(remote)
    return true
  }

  #write(row: T): void {
    const columns = this.#columns
    this.#db
      .prepare(
        `INSERT OR REPLACE INTO ${this.#table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      )
      .run(...columns.map((c) => row[c] ?? null))
  }
}
