const VERSION = 'v2';
const CACHE = `app-thumbnail-maker-${VERSION}`;

const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './app-enhancements.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

// External CDN resources (cached for offline use).
const CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(LOCAL_ASSETS);
    await Promise.all(CDN_ASSETS.map(async (url) => {
      try {
        const response = await fetch(url, { mode: 'no-cors' });
        await cache.put(url, response);
      } catch (_) { /* Ignore CDN failures during offline installation. */ }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function addAppEnhancements(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const html = await response.text();
  if (html.includes('app-enhancements.js')) {
    return new Response(html, { status: response.status, statusText: response.statusText, headers: response.headers });
  }

  const updatedHtml = html.replace(/<\/body\s*>/i, '<script src="./app-enhancements.js"></script></body>');
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(updatedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!/^https?:$/.test(url.protocol)) return;

  // Navigation: network first, with cached HTML as the offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put('./index.html', fresh.clone());
        return await addAppEnhancements(fresh);
      } catch (_) {
        const cached = await caches.match(request, { ignoreSearch: true }) ||
          await caches.match('./index.html') || await caches.match('./');
        return cached ? addAppEnhancements(cached) : Response.error();
      }
    })());
    return;
  }

  // Static assets and CDN resources: cache first, then refresh in the background.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    const network = fetch(request).then((response) => {
      if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone());
      return response;
    }).catch(() => null);
    return cached || (await network) || Response.error();
  })());
});
