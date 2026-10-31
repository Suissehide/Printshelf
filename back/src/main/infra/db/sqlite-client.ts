import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

// Deux familles de tables :
// - LOCALES à la machine (source, file, setting) : les chemins diffèrent d'un ordinateur à l'autre.
// - SYNCHRONISÉES (model_meta, collection, collection_model, queue_item) : rattachées au HASH du
//   contenu, jamais au chemin, avec un identifiant texte stable, `updated_at` (ms) et `deleted`
//   (pierre tombale) pour la fusion entre machines (voir `domain/sync.domain.ts`).
const SCHEMA = `
CREATE TABLE IF NOT EXISTS setting (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS source (
  id INTEGER PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS file (
  path TEXT PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dir TEXT NOT NULL,
  ext TEXT NOT NULL,
  size INTEGER NOT NULL,
  mtime REAL NOT NULL,
  hash TEXT NOT NULL,
  archive TEXT
);
CREATE INDEX IF NOT EXISTS file_hash ON file(hash);
CREATE TABLE IF NOT EXISTS model_meta (
  id TEXT PRIMARY KEY, -- = hash du contenu
  tags TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  favorite INTEGER NOT NULL DEFAULT 0,
  sent_at INTEGER,
  sent_count INTEGER,
  creator TEXT,
  source_url TEXT,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS collection (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS collection_model (
  id TEXT PRIMARY KEY, -- = collection_id + ':' + hash
  collection_id TEXT NOT NULL,
  hash TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS preference (
  id TEXT PRIMARY KEY, -- clé : 'slicers', 'printers'
  value TEXT NOT NULL, -- JSON
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS model_dims (
  hash TEXT PRIMARY KEY, -- local : recalculable partout, inutile à synchroniser
  x REAL,
  y REAL,
  z REAL
);
CREATE TABLE IF NOT EXISTS model_about (
  hash TEXT PRIMARY KEY, -- local : lu dans le fichier et son pack, recalculable partout
  title TEXT,
  designer TEXT,
  description TEXT,
  license TEXT,
  origin TEXT
);
CREATE TABLE IF NOT EXISTS queue_item (
  id TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);
`

export const SYNCED_TABLES = [
  'model_meta',
  'collection',
  'collection_model',
  'queue_item',
  'preference',
] as const
export type SyncedTable = (typeof SYNCED_TABLES)[number]

// Colonnes ajoutées après la création de bases existantes. Nullables : un fichier de synchro
// écrit par une version plus ancienne ne les porte pas.
const ADDED_COLUMNS: [string, string, string][] = [
  ['model_meta', 'sent_at', 'INTEGER'],
  ['model_meta', 'sent_count', 'INTEGER'],
  ['model_meta', 'creator', 'TEXT'],
  ['model_meta', 'source_url', 'TEXT'],
]

const migrate = (db: DatabaseSync) => {
  for (const [table, column, type] of ADDED_COLUMNS) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as {
      name: string
    }[]
    if (!columns.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)
    }
  }
}

const DB_FILE = 'printshelf.db'
// Nom d'avant le renommage du projet : repris tel quel au premier démarrage.
const LEGACY_DB_FILE = 'meshory.db'

const adoptLegacyDatabase = (dataDir: string) => {
  const target = path.join(dataDir, DB_FILE)
  const legacy = path.join(dataDir, LEGACY_DB_FILE)
  if (!fs.existsSync(target) && fs.existsSync(legacy)) {
    for (const suffix of ['', '-wal', '-shm']) {
      if (fs.existsSync(legacy + suffix)) {
        fs.renameSync(legacy + suffix, target + suffix)
      }
    }
  }
}

export const createSqliteClient = (dataDir: string): DatabaseSync => {
  fs.mkdirSync(dataDir, { recursive: true })
  adoptLegacyDatabase(dataDir)
  const db = new DatabaseSync(path.join(dataDir, DB_FILE))
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  db.exec(SCHEMA)
  migrate(db)
  return db
}

export const inTransaction = <T>(db: DatabaseSync, fn: () => T): T => {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
