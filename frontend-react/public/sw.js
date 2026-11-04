// Service worker do Omni-EcoRescue: guarda o app no celular para abrir SEM INTERNET.
// - Páginas: tenta a rede; sem rede, abre a cópia guardada (o React decide a tela).
// - Arquivos do build (/assets/*, com hash no nome): guardados para sempre.
// - Busca de locais (/api/v1/places/*): tenta a rede; sem rede, devolve a última resposta guardada.
// Não guarda dados pessoais nem chamadas de outras rotas da API (cadastros, alertas).
const VERSAO = 'omni-offline-v1'
const PAGINAS = ['/', '/index.html', '/cidadao', '/preparar', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

async function guardarApp() {
  const cache = await caches.open(VERSAO)
  await Promise.allSettled(PAGINAS.map(u => cache.add(new Request(u, { cache: 'reload' }))))
  // Lê o index.html e guarda os arquivos do build que ele carrega (JS e CSS principais).
  try {
    const html = await (await fetch('/index.html', { cache: 'reload' })).text()
    const arquivos = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m => m[1])
    await Promise.allSettled(arquivos.map(u => cache.add(u)))
  } catch { /* sem rede na instalação: guarda na próxima visita */ }
}

self.addEventListener('install', event => {
  event.waitUntil(guardarApp().then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const nome of await caches.keys()) if (nome !== VERSAO) await caches.delete(nome)
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const resp = await fetch(req)
        const cache = await caches.open(VERSAO)
        cache.put('/index.html', resp.clone())
        return resp
      } catch {
        const cache = await caches.open(VERSAO)
        return (await cache.match('/index.html')) || (await cache.match('/')) || Response.error()
      }
    })())
    return
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSAO)
      const salvo = await cache.match(req)
      if (salvo) return salvo
      const resp = await fetch(req)
      if (resp.ok) cache.put(req, resp.clone())
      return resp
    })())
    return
  }

  if (url.pathname.startsWith('/api/v1/places/')) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSAO)
      try {
        const resp = await fetch(req)
        if (resp.ok) cache.put(req, resp.clone())
        return resp
      } catch {
        return (await cache.match(req)) || Response.error()
      }
    })())
  }
})
