/*
 * Rowville Eagles service worker — only for the coach portal at the ground with poor reception.
 * Coach pages (dashboard, training day, groups) are fetched from the network first; the last good copy is kept
 * so it can still be read offline. Nothing else on the site is cached. Logging out clears it.
 */
const PAGES = 'coach-pages-v1'
const ASSETS = 'coach-assets-v1'
const OFFLINE_PATHS = [/^\/coach\/?$/, /^\/coach\/today/, /^\/coach\/groups/]

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== PAGES && k !== ASSETS).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'clear') event.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(ASSETS)]))
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Build files never change once published: keep the ones coach pages use
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone())
        return res
      }),
    )
    return
  }

  if (req.mode === 'navigate' && OFFLINE_PATHS.some((re) => re.test(url.pathname))) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) caches.open(PAGES).then((c) => c.put(req, res.clone()))
          return res
        })
        .catch(async () => (await caches.match(req)) || (await caches.match('/coach/today')) || new Response('<h1>Offline</h1><p>Open this page once with signal and it will be saved for next time.</p>', { headers: { 'content-type': 'text/html' } })),
    )
  }
})

// Notifications (coach portal): show them, and open the right page when tapped
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { title: 'Rowville Eagles', body: event.data ? event.data.text() : '' } }
  event.waitUntil(self.registration.showNotification(data.title || 'Rowville Eagles', { body: data.body || '', tag: data.tag, icon: '/icon.png', badge: '/icon.png', data: { url: data.url || '/coach' } }))
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/coach'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const same = wins.find((w) => w.url.startsWith(self.location.origin))
      if (same) return same.navigate(url).then((w) => (w || same).focus())
      return self.clients.openWindow(url)
    }),
  )
})
