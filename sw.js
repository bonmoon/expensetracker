const CACHE_NAME = 'butler-finance-v4';
const APP_SHELL = [
  '/',
  '/index.html',
  '/css/main.css',
  '/js/app.js',
  '/js/character.js',
  '/js/db.js',
  '/js/sheets.js',
  '/js/ai.js',
  '/js/charts.js',
  '/js/parallax.js',
  '/js/butler-dialog.js',
  '/applaunch.mp3',
  '/images/characters/aaron/Aaron1.png',
  '/images/characters/aaron/Aaron2.PNG',
  '/images/characters/aaron/video.mp4',
  '/images/savingbackground.png',
  '/images/taroteye1.png',
  '/images/taroteye2.png',
  '/images/taroteye3.png',
  '/images/taroteye4.png',
  '/images/taroteye5.png',
  '/images/taroteye6.png',
  '/images/icons/appicon.png',
  '/images/icons/app-icon.png',
  '/images/icons/quick.png',
  '/images/icons/ai.png',
  '/images/icons/chart.png',
  '/images/icons/savings.png',
  '/images/icons/setting-icon.png',
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
    event.respondWith(networkFirst(request, '/index.html'));
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
