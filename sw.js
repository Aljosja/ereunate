/* Service worker: alles wordt bij installatie opgeslagen, zodat de app offline werkt.
   Bij elke nieuwe release VERSION ophogen; de app biedt dan "Vernieuwen" aan. */
const VERSION = 'v1.0.1';
const CACHE = 'ereunate-' + VERSION;
const FILES = [
  './', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest',
  'data/books.json', 'data/map.json', 'data/sv.json', 'data/grc.json', 'data/heb.json',
  'fonts/noto-serif-latin-400-normal.woff2', 'fonts/noto-serif-latin-ext-400-normal.woff2',
  'fonts/noto-serif-greek-400-normal.woff2', 'fonts/noto-serif-greek-ext-400-normal.woff2',
  'fonts/noto-serif-latin-600-normal.woff2', 'fonts/noto-serif-latin-ext-600-normal.woff2',
  'fonts/noto-serif-greek-600-normal.woff2', 'fonts/noto-serif-greek-ext-600-normal.woff2',
  'fonts/noto-serif-hebrew-hebrew-400-normal.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
  'icons/apple-touch-icon.png', 'icons/favicon-32.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('ereunate-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('index.html').then(r => r || fetch(req)));
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
