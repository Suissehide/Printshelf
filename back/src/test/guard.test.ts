import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildContainer } from '../main/application/container.ts'
import { buildHttpServer } from '../main/interfaces/http/fastify/fastify-http-server.ts'
import { testConfig } from './test-config.ts'

const server = async (overrides: Partial<typeof testConfig>) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'printshelf-guard-'))
  return buildHttpServer(
    buildContainer({ ...testConfig, DATA_DIR: dataDir, ...overrides }),
  )
}
const basic = (credentials: string) =>
  `Basic ${Buffer.from(credentials).toString('base64')}`

describe('garde-fous HTTP', () => {
  it('en mode bureau : refuse un hôte étranger (DNS rebinding) et les écritures non JSON', async () => {
    const app = await server({})
    expect(
      (
        await app.inject({
          url: '/api/files',
          headers: { host: 'localhost:4747' },
        })
      ).statusCode,
    ).toBe(200)
    expect(
      (
        await app.inject({
          url: '/api/files',
          headers: { host: 'evil.example:4747' },
        })
      ).statusCode,
    ).toBe(403)
    const form = await app.inject({
      method: 'POST',
      url: '/api/sync/now',
      headers: { host: 'localhost', 'content-type': 'text/plain' },
      payload: '{}',
    })
    expect(form.statusCode).toBe(415)
  })

  it('en mode serveur : exige le mot de passe, sauf pour la sonde de santé, et coupe les actions de bureau', async () => {
    const app = await server({
      DESKTOP: false,
      ALLOWED_HOSTS: ['printshelf.example.com'],
      AUTH_PASSWORD: 'un-mot-de-passe-solide',
    })
    const host = 'printshelf.example.com'
    const anonymous = await app.inject({ url: '/api/files', headers: { host } })
    expect(anonymous.statusCode).toBe(401)
    expect(anonymous.headers['www-authenticate']).toContain('Basic')
    expect(
      (
        await app.inject({
          url: '/api/files',
          headers: { host, authorization: basic('printshelf:faux') },
        })
      ).statusCode,
    ).toBe(401)
    const auth = {
      host,
      authorization: basic('printshelf:un-mot-de-passe-solide'),
    }
    expect(
      (await app.inject({ url: '/api/files', headers: auth })).statusCode,
    ).toBe(200)
    expect(
      (await app.inject({ url: '/api/health', headers: { host: 'localhost' } }))
        .statusCode,
    ).toBe(200)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/system/open',
          headers: auth,
          payload: { path: '/x' },
        })
      ).statusCode,
    ).toBe(501)
    expect(
      (
        await app.inject({ url: '/api/system/capabilities', headers: auth })
      ).json(),
    ).toEqual({ desktop: false, sourcesRoot: null })
  })

  it('n’accepte comme lien d’origine qu’une adresse http(s)', async () => {
    const app = await server({})
    const hash = 'c'.repeat(40)
    const patch = (sourceUrl: string) =>
      app.inject({
        method: 'PATCH',
        url: `/api/metas/${hash}`,
        headers: { host: 'localhost' },
        payload: { sourceUrl },
      })
    expect((await patch('javascript:alert(1)')).statusCode).toBe(400)
    expect((await patch('file:///etc/passwd')).statusCode).toBe(400)
    const ok = await patch('https://www.printables.com/model/1')
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toMatchObject({
      sourceUrl: 'https://www.printables.com/model/1',
    })
    expect((await patch('')).json()).toMatchObject({ sourceUrl: '' })
  })

  it('n’accepte un import que du navigateur local, en mode bureau, depuis une page http(s)', async () => {
    const desktop = await server({})
    const post = (
      app: Awaited<ReturnType<typeof server>>,
      pageUrl: string,
      headers = { host: 'localhost' },
    ) =>
      app.inject({
        method: 'POST',
        url: '/api/imports',
        headers,
        payload: { path: '/tmp/x.stl', pageUrl },
      })
    expect((await post(desktop, 'javascript:alert(1)')).statusCode).toBe(400)
    expect(
      (await post(desktop, 'https://www.printables.com/model/1')).statusCode,
    ).toBe(400) // fichier absent
    const headless = await server({
      DESKTOP: false,
      AUTH_PASSWORD: 'un-mot-de-passe-solide',
    })
    const auth = {
      host: 'localhost',
      authorization: basic('printshelf:un-mot-de-passe-solide'),
    }
    expect(
      (await post(headless, 'https://www.printables.com/model/1', auth))
        .statusCode,
    ).toBe(501)
  })
})
