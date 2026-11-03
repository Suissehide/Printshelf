import { readPageInfo } from './page-info.js'

// Un téléchargement de modèle (ou de pack ZIP) lancé depuis une page de modèle reconnue est
// signalé à Printshelf une fois terminé. Printshelf le COPIE dans son dossier d'import : le fichier
// téléchargé reste où il est.

const SITES = /(^|\.)(printables\.com|makerworld\.com|thingiverse\.com|cults3d\.com|myminifactory\.com)$/
const MODEL_FILE = /\.(3mf|stl|obj|ply|glb|step|stp|gcode|zip|rar|7z)$/i
const DEFAULTS = { server: 'http://localhost:4747', enabled: true }

const settings = async () => ({ ...DEFAULTS, ...(await chrome.storage.local.get(['server', 'enabled'])) })
const fromKnownSite = (url) => {
  try {
    const { protocol, hostname } = new URL(url)
    return protocol === 'https:' && SITES.test(hostname)
  } catch {
    return false
  }
}

// Page d'origine : l'onglet qui a lancé le téléchargement (référent), sinon l'onglet actif.
const findPage = async (item) => {
  const tabs = await chrome.tabs.query({})
  const referrer = item.referrer && fromKnownSite(item.referrer) ? item.referrer : null
  const tab =
    tabs.find((t) => referrer && t.url && referrer.startsWith(t.url.split('#')[0])) ??
    tabs.find((t) => t.active && t.url && fromKnownSite(t.url))
  if (!tab && !referrer) {
    return null
  }
  if (tab?.id !== undefined) {
    try {
      const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readPageInfo })
      if (result?.pageUrl && fromKnownSite(result.pageUrl)) {
        return result
      }
    } catch {
      // page protégée ou fermée entre-temps : on se contente du lien
    }
  }
  return { pageUrl: referrer ?? tab.url }
}

const remember = async (entry) => {
  const { history = [] } = await chrome.storage.local.get('history')
  await chrome.storage.local.set({ history: [entry, ...history].slice(0, 20) })
  chrome.action.setBadgeText({ text: entry.ok ? '✓' : '!' })
  chrome.action.setBadgeBackgroundColor({ color: entry.ok ? '#16a34a' : '#dc2626' })
}

chrome.downloads.onCreated.addListener(async (item) => {
  const { enabled } = await settings()
  if (!enabled) {
    return
  }
  const page = await findPage(item)
  if (page) {
    // Le service worker peut s'endormir pendant un long téléchargement : on garde la page en session.
    await chrome.storage.session.set({ [`download:${item.id}`]: page })
  }
})

chrome.downloads.onChanged.addListener(async (delta) => {
  if (delta.state?.current !== 'complete') {
    return
  }
  const key = `download:${delta.id}`
  const { [key]: page } = await chrome.storage.session.get(key)
  await chrome.storage.session.remove(key)
  const [item] = await chrome.downloads.search({ id: delta.id })
  if (!(page && item?.filename && MODEL_FILE.test(item.filename))) {
    return
  }
  const { server } = await settings()
  const name = item.filename.split(/[\\/]/).pop()
  try {
    const response = await fetch(`${server}/api/imports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: item.filename, ...page }),
    })
    const body = await response.json().catch(() => ({}))
    await remember({
      ok: response.ok,
      name,
      title: page.title ?? name,
      creator: page.creator,
      message: response.ok ? `Rangé dans ${body.folder}` : (body.message ?? `Erreur ${response.status}`),
      at: Date.now(),
    })
  } catch {
    await remember({ ok: false, name, title: page.title ?? name, message: 'Printshelf ne répond pas : est-il lancé ?', at: Date.now() })
  }
})
