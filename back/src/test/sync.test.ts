import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildContainer } from '../main/application/container.ts'
import { testConfig } from './test-config.ts'

const HASH = 'a'.repeat(40)

// Deux « ordinateurs » (deux dossiers de données) partagent un même dossier de synchro.
const twoMachines = async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'printshelf-sync-'))
  const shared = path.join(root, 'cloud')
  await fs.mkdir(shared)
  const machine = (name: string) =>
    buildContainer({
      ...testConfig,
      DATA_DIR: path.join(root, name),
      FRONT_DIST: path.join(root, 'none'),
    })
  const mac = machine('mac')
  const pc = machine('pc')
  await mac.syncDomain.setFolder(shared)
  await pc.syncDomain.setFolder(shared)
  return { mac, pc }
}

describe('synchronisation entre machines', () => {
  it('propage tags, collections et suppressions, la modification la plus récente gagnant', async () => {
    const { mac, pc } = await twoMachines()

    mac.organizerDomain.updateMeta(HASH, { tags: ['Dragon', 'deco'] })
    const collection = mac.organizerDomain.createCollection(
      'Cadeaux',
      '#f97316',
    )
    mac.organizerDomain.setInCollection(collection.id, [HASH], true)
    await mac.syncDomain.syncNow()
    const before = pc.syncDomain.status.revision
    await pc.syncDomain.syncNow()

    expect(pc.syncDomain.status.revision).toBe(before + 1)
    expect(pc.organizerDomain.listMetas()).toEqual([
      {
        hash: HASH,
        tags: ['deco', 'dragon'],
        notes: '',
        favorite: false,
        sentAt: null,
        sentCount: 0,
      },
    ])
    expect(pc.organizerDomain.listCollections()).toEqual([
      { ...collection, hashes: [HASH] },
    ])
    expect(pc.syncDomain.status.devices.map((d) => d.deviceId)).toEqual([
      mac.syncDomain.status.deviceId,
    ])

    // Le PC modifie ensuite : sa version, plus récente, l'emporte sur le Mac.
    await new Promise((r) => setTimeout(r, 5))
    pc.organizerDomain.updateMeta(HASH, { tags: ['dragon'] })
    pc.organizerDomain.removeCollection(collection.id)
    await pc.syncDomain.syncNow()
    await mac.syncDomain.syncNow()

    expect(mac.organizerDomain.listMetas()[0].tags).toEqual(['dragon'])

    // Envoi au slicer et préférences (imprimantes) suivent le même chemin.
    mac.organizerDomain.markSent([HASH])
    mac.organizerDomain.setPreference('printers', [
      { id: 'a1', name: 'A1', x: 256, y: 256, z: 256 },
    ])
    await mac.syncDomain.syncNow()
    await pc.syncDomain.syncNow()
    const [meta] = pc.organizerDomain.listMetas()
    expect(meta).toMatchObject({ tags: ['dragon'], sentCount: 1 })
    expect(meta.sentAt).toBeGreaterThan(0)
    expect(pc.organizerDomain.listPreferences().printers).toEqual([
      { id: 'a1', name: 'A1', x: 256, y: 256, z: 256 },
    ])
    expect(mac.organizerDomain.listCollections()).toEqual([])
  })

  it('refuse un fichier de synchro qui tente d’écrire une colonne inconnue', async () => {
    const { mac } = await twoMachines()
    const row = {
      id: HASH,
      tags: '[]',
      notes: '',
      favorite: 0,
      updated_at: Date.now(),
      deleted: 0,
      'evil) VALUES (1); --': 1,
    }
    mac.syncDomain.restore({
      version: 1,
      deviceId: 'x',
      deviceName: 'x',
      exportedAt: 0,
      tables: { model_meta: [row] },
    })
    expect(mac.organizerDomain.listMetas()).toEqual([
      {
        hash: HASH,
        tags: [],
        notes: '',
        favorite: false,
        sentAt: null,
        sentCount: 0,
      },
    ])
  })

  it('reprend l’ancienne base et lit encore l’ancien dossier de synchro (avant le renommage)', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'printshelf-legacy-'))
    const shared = path.join(root, 'cloud')
    await fs.mkdir(path.join(shared, 'meshory-sync'), { recursive: true })

    // Ancienne installation : base nommée meshory.db, avec un tag.
    const oldData = path.join(root, 'old')
    const old = buildContainer({ ...testConfig, DATA_DIR: oldData })
    old.organizerDomain.updateMeta(HASH, { tags: ['ancien'] })
    await fs.rename(
      path.join(oldData, 'printshelf.db'),
      path.join(oldData, 'meshory.db'),
    )
    const reopened = buildContainer({ ...testConfig, DATA_DIR: oldData })
    expect(reopened.organizerDomain.listMetas()[0].tags).toEqual(['ancien'])

    // Une machine pas encore mise à jour écrit toujours dans meshory-sync/.
    await fs.writeFile(
      path.join(shared, 'meshory-sync', 'vieux-pc.json'),
      JSON.stringify({
        version: 1,
        deviceId: 'vieux-pc',
        deviceName: 'VIEUX-PC',
        exportedAt: Date.now(),
        tables: {
          model_meta: [
            {
              id: 'b'.repeat(40),
              tags: '["partagé"]',
              notes: '',
              favorite: 0,
              updated_at: Date.now(),
              deleted: 0,
            },
          ],
        },
      }),
    )
    const fresh = buildContainer({
      ...testConfig,
      DATA_DIR: path.join(root, 'new'),
    })
    await fresh.syncDomain.setFolder(shared)
    expect(fresh.organizerDomain.listMetas().map((m) => m.tags)).toEqual([
      ['partagé'],
    ])
    expect(fresh.syncDomain.status.devices.map((d) => d.deviceName)).toEqual([
      'VIEUX-PC',
    ])
    // Et on n'écrit que dans le nouveau dossier.
    expect(await fs.readdir(path.join(shared, 'printshelf-sync'))).toEqual([
      `${fresh.syncDomain.status.deviceId}.json`,
    ])
  })
})
