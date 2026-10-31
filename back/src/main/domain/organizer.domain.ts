import { randomUUID } from 'node:crypto'
import Boom from '@hapi/boom'

import type {
  SyncedRepository,
  SyncedRow,
} from '../infra/repositories/synced.repository.ts'

export type ModelMetaRow = SyncedRow & {
  sent_at: number | null
  sent_count: number | null
  tags: string
  notes: string
  favorite: number
}
export type CollectionRow = SyncedRow & { name: string; color: string }
export type CollectionModelRow = SyncedRow & {
  collection_id: string
  hash: string
}
export type QueueItemRow = SyncedRow & {
  hash: string
  name: string
  status: QueueStatus
  quantity: number
  created_at: number
}
export type QueueStatus = 'TODO' | 'PRINTING' | 'DONE' | 'FAILED'

export type ModelMeta = {
  // Dernier envoi au slicer (toutes machines confondues) et nombre d'envois.
  sentAt: number | null
  sentCount: number
  hash: string
  tags: string[]
  notes: string
  favorite: boolean
}
export type Collection = {
  id: string
  name: string
  color: string
  hashes: string[]
}
export type QueueItem = {
  id: string
  hash: string
  name: string
  status: QueueStatus
  quantity: number
  createdAt: number
}

export type PreferenceRow = SyncedRow & { value: string }

export type OrganizerRepositories = {
  preferenceRepository: SyncedRepository<PreferenceRow>
  modelMetaRepository: SyncedRepository<ModelMetaRow>
  collectionRepository: SyncedRepository<CollectionRow>
  collectionModelRepository: SyncedRepository<CollectionModelRow>
  queueItemRepository: SyncedRepository<QueueItemRow>
}

const toMeta = (m: ModelMetaRow): ModelMeta => ({
  hash: m.id,
  tags: JSON.parse(m.tags) as string[],
  notes: m.notes,
  favorite: m.favorite === 1,
  sentAt: m.sent_at ?? null,
  sentCount: m.sent_count ?? 0,
})

// Tout ce que l'utilisateur ajoute par-dessus ses fichiers : tags, notes, favoris, collections,
// file d'impression. Rattaché au hash du contenu, donc synchronisé entre machines.
export class OrganizerDomain {
  readonly #metas: SyncedRepository<ModelMetaRow>
  readonly #collections: SyncedRepository<CollectionRow>
  readonly #members: SyncedRepository<CollectionModelRow>
  readonly #queue: SyncedRepository<QueueItemRow>
  readonly #preferences: SyncedRepository<PreferenceRow>

  constructor(repositories: OrganizerRepositories) {
    this.#metas = repositories.modelMetaRepository
    this.#collections = repositories.collectionRepository
    this.#members = repositories.collectionModelRepository
    this.#queue = repositories.queueItemRepository
    this.#preferences = repositories.preferenceRepository
  }

  // * MÉTADONNÉES

  listMetas(): ModelMeta[] {
    return this.#metas.list().map(toMeta)
  }

  updateMeta(
    hash: string,
    patch: Partial<Pick<ModelMeta, 'tags' | 'notes' | 'favorite'>>,
  ): ModelMeta {
    const next = { ...this.#meta(hash), ...patch }
    next.tags = [
      ...new Set(next.tags.map((t) => t.trim().toLowerCase()).filter(Boolean)),
    ].sort()
    this.#saveMeta(next)
    return next
  }

  // Appelé à chaque envoi au slicer : alimente la vue « Envoyés au slicer ».
  markSent(hashes: string[]): void {
    const now = Date.now()
    for (const hash of new Set(hashes)) {
      const current = this.#meta(hash)
      this.#saveMeta({
        ...current,
        sentAt: now,
        sentCount: current.sentCount + 1,
      })
    }
  }

  #meta(hash: string): ModelMeta {
    const row = this.#metas.get(hash)
    return row
      ? toMeta(row)
      : {
          hash,
          tags: [],
          notes: '',
          favorite: false,
          sentAt: null,
          sentCount: 0,
        }
  }

  #saveMeta(meta: ModelMeta): void {
    this.#metas.save({
      id: meta.hash,
      tags: JSON.stringify(meta.tags),
      notes: meta.notes,
      favorite: meta.favorite ? 1 : 0,
      sent_at: meta.sentAt,
      sent_count: meta.sentCount,
    })
  }

  // * PRÉFÉRENCES (synchronisées : imprimantes, règles de slicer)

  listPreferences(): Record<string, unknown> {
    return Object.fromEntries(
      this.#preferences.list().map((p) => [p.id, JSON.parse(p.value)]),
    )
  }

  setPreference(key: string, value: unknown): void {
    this.#preferences.save({ id: key, value: JSON.stringify(value) })
  }

  // * COLLECTIONS

  listCollections(): Collection[] {
    const members = this.#members.list()
    return this.#collections
      .list()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        hashes: members
          .filter((m) => m.collection_id === c.id)
          .map((m) => m.hash),
      }))
  }

  createCollection(name: string, color: string): Collection {
    const row = this.#collections.save({
      id: randomUUID(),
      name: name.trim(),
      color,
    })
    return { id: row.id, name: row.name, color: row.color, hashes: [] }
  }

  updateCollection(id: string, patch: { name?: string; color?: string }): void {
    const current = this.#requireCollection(id)
    this.#collections.save({
      id,
      name: patch.name?.trim() ?? current.name,
      color: patch.color ?? current.color,
    })
  }

  removeCollection(id: string): void {
    this.#requireCollection(id)
    for (const member of this.#members
      .list()
      .filter((m) => m.collection_id === id)) {
      this.#members.remove(member.id)
    }
    this.#collections.remove(id)
  }

  setInCollection(id: string, hashes: string[], included: boolean): void {
    this.#requireCollection(id)
    for (const hash of hashes) {
      const memberId = `${id}:${hash}`
      if (included) {
        this.#members.save({ id: memberId, collection_id: id, hash })
      } else if (this.#members.get(memberId)) {
        this.#members.remove(memberId)
      }
    }
  }

  #requireCollection(id: string): CollectionRow {
    const collection = this.#collections.get(id)
    if (!collection) {
      throw Boom.notFound('Collection introuvable')
    }
    return collection
  }

  // * FILE D'IMPRESSION

  listQueue(): QueueItem[] {
    return this.#queue
      .list()
      .sort((a, b) => a.created_at - b.created_at)
      .map((q) => ({
        id: q.id,
        hash: q.hash,
        name: q.name,
        status: q.status,
        quantity: q.quantity,
        createdAt: q.created_at,
      }))
  }

  addToQueue(hash: string, name: string, quantity = 1): void {
    this.#queue.save({
      id: randomUUID(),
      hash,
      name,
      status: 'TODO',
      quantity,
      created_at: Date.now(),
    })
  }

  updateQueueItem(
    id: string,
    patch: { status?: QueueStatus; quantity?: number },
  ): void {
    const current = this.#queue.get(id)
    if (!current) {
      throw Boom.notFound('Élément introuvable dans la file')
    }
    const { updated_at: _updatedAt, deleted: _deleted, ...rest } = current
    this.#queue.save({ ...rest, ...patch })
  }

  removeQueueItem(id: string): void {
    this.#queue.remove(id)
  }
}
