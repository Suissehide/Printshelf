// Lit la page d'un modèle (exécuté DANS la page, via chrome.scripting) : uniquement des données
// standard — Open Graph, JSON-LD, balise author — et le motif « Nom by Créateur » des titres.
// Aucun sélecteur propre à un site : rien ne casse quand un site change sa mise en page ;
// au pire le créateur reste vide et se complète dans Printshelf.
export function readPageInfo() {
  const meta = (selector) => document.querySelector(selector)?.getAttribute('content')?.trim() || undefined
  const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((s) => {
    try {
      const data = JSON.parse(s.textContent)
      return Array.isArray(data) ? data : [data, ...(data['@graph'] ?? [])]
    } catch {
      return []
    }
  })
  const personName = (v) => (typeof v === 'string' ? v : Array.isArray(v) ? personName(v[0]) : v?.name)
  const item = jsonLd.find((j) => j && (j.author || j.creator)) ?? jsonLd.find((j) => j?.name)

  const SITE_SUFFIX = /\s+[|–—-]\s+.*(printables|thingiverse|makerworld|cults|myminifactory).*$/i
  let title = (meta('meta[property="og:title"]') || item?.name || document.title || '').replace(SITE_SUFFIX, '')
  let creator = personName(item?.author) || personName(item?.creator) || meta('meta[name="author"]')
  const by = title.match(/^(.+?)\s+by\s+(.+)$/i)
  if (by) {
    title = by[1]
    creator = creator || by[2]
  }
  const canonical = document.querySelector('link[rel="canonical"]')?.href
  return {
    pageUrl: canonical?.startsWith('https://') ? canonical : location.href,
    title: title.trim().slice(0, 300) || undefined,
    creator: creator?.trim().slice(0, 120) || undefined,
    imageUrl: meta('meta[property="og:image"]') || undefined,
    description: (meta('meta[property="og:description"]') || item?.description || '').trim().slice(0, 20000) || undefined,
  }
}
