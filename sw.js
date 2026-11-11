// Service worker: приложение открывается даже без интернета.
// Стратегия «сначала сеть»: при наличии сети всегда свежая версия, без сети — из кэша.
// Запросы к GitHub API не трогаем — они идут мимо кэша.

const CACHE = 'budget-shell-v1';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/store.js',
  './js/sync.js',
  './js/util.js',
  './js/charts.js',
  './js/config.js',
  './icons/icon.svg',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((r) => { clearTimeout(t); resolve(r); }, (err) => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      let res = await withTimeout(fetch(req.url, { cache: 'no-cache' }), 4000);
      // Safari не принимает ответ с редиректом на навигационный запрос — отдаём чистую копию
      if (res.redirected) res = new Response(await res.blob(), { status: res.status, headers: res.headers });
      if (res.ok) cache.put(req.mode === 'navigate' ? './index.html' : req, res.clone());
      return res;
    } catch {
      const hit = await cache.match(req.mode === 'navigate' ? './index.html' : req, { ignoreSearch: true });
      return hit || (await cache.match('./index.html')) || Response.error();
    }
  })());
});
