/* Capital Bank of Australia – service worker (scope: site root) */
const VERSION = 'cboa-v1';
const SHELL = [
  './', 'index.html', 'home.html', 'enter.html', 'open.html',
  'manifest.webmanifest', 'pwa.js',
  'logo-mark.png', 'logo.png',
  'bank-building-day.webp', 'bank-building-evening.webp',
  'bank-loan-consultation.webp', 'bank-service-team.webp',
  'assets/capital-building.webp',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-512-maskable.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => Promise.allSettled(SHELL.map((u) => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Never touch cross-origin traffic (bank API, OTP endpoint, fonts, etc.)
  if (url.origin !== self.location.origin) return;

  // Pages: network first so updates and live data are never stale, cache as offline fallback
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      } catch (_) {
        return (await caches.match(req, { ignoreSearch: true })) || (await caches.match('home.html')) || (await caches.match('index.html')) || Response.error();
      }
    })());
    return;
  }

  // Static files: serve from cache, refresh in the background
  event.respondWith((async () => {
    const cached = await caches.match(req);
    const refresh = fetch(req).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => cached);
    return cached || refresh;
  })());
});
