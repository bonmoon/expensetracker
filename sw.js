const CACHE_NAME = 'butler-finance-v6';
const BASE_URL = new URL('./', self.location.href);
const INDEX_URL = new URL('index.html', BASE_URL).toString();
const APP_SHELL = [
  new URL('./', BASE_URL).toString(),
  INDEX_URL,
  new URL('css/main.css', BASE_URL).toString(),
  new URL('js/app.js', BASE_URL).toString(),
  new URL('js/character.js', BASE_URL).toString(),
  new URL('js/db.js', BASE_URL).toString(),
  new URL('js/sheets.js', BASE_URL).toString(),
  new URL('js/ai.js', BASE_URL).toString(),
  new URL('js/charts.js', BASE_URL).toString(),
  new URL('js/parallax.js', BASE_URL).toString(),
  new URL('js/butler-dialog.js', BASE_URL).toString(),
  new URL('images/icons/appicon.png', BASE_URL).toString(),
  new URL('images/icons/quick.png', BASE_URL).toString(),
  new URL('images/icons/ai.png', BASE_URL).toString(),
  new URL('images/icons/chart.png', BASE_URL).toString(),
  new URL('images/icons/savings.png', BASE_URL).toString(),
  new URL('images/icons/setting-icon.png', BASE_URL).toString(),
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, INDEX_URL));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (isStaticAsset(request)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function networkFirst(request, fallbackPath) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request, { cache: 'no-store' });
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return cache.match(fallbackPath);
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    cache.put(request, response.clone());
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

function isStaticAsset(request) {
  return ['style', 'script', 'image', 'font', 'video'].includes(request.destination);
}
