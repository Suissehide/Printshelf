const DEFAULTS = { server: 'http://localhost:4747', enabled: true }
const $ = (id) => document.getElementById(id)

const render = async () => {
  const { server, enabled, history = [] } = { ...DEFAULTS, ...(await chrome.storage.local.get(['server', 'enabled', 'history'])) }
  $('server').value = server
  $('enabled').checked = enabled
  $('history').replaceChildren(
    ...(history.length
      ? history.map((h) => {
          const li = document.createElement('li')
          li.className = h.ok ? 'ok' : 'ko'
          const title = document.createElement('div')
          title.className = 'title'
          title.textContent = h.creator ? `${h.title} — ${h.creator}` : h.title
          const msg = document.createElement('div')
          msg.className = 'msg'
          msg.textContent = h.message
          li.append(title, msg)
          return li
        })
      : [Object.assign(document.createElement('li'), { className: 'empty', textContent: 'Aucun pour l’instant.' })]),
  )
  try {
    const folder = await (await fetch(`${server}/api/imports/folder`)).json()
    $('status').className = 'dot ok'
    if (folder.folder) {
      $('folder').textContent = folder.folder
    }
  } catch {
    $('status').className = 'dot ko'
    $('status').title = 'Printshelf ne répond pas : est-il lancé ?'
  }
}

$('enabled').addEventListener('change', (e) => chrome.storage.local.set({ enabled: e.target.checked }))
$('server').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ server: e.target.value.replace(/\/+$/, '') || DEFAULTS.server })
  render()
})
chrome.action.setBadgeText({ text: '' })
render()
