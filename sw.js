const CACHE_NAME = 'cekbon-cache-v16';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  // Biarkan SW baru menginstal tapi jangan paksa aktif langsung jika ada tab lain terbuka
  // Ini mencegah loop reload yang agresif
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('Menghapus cache lama:', key);
          return caches.delete(key);
        }
      })
    ))
  );
});

self.addEventListener('fetch', (event) => {
  // Strategi Stale-While-Revalidate untuk aset agar cepat tapi tetap terupdate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => null);

      return cachedResponse || fetchPromise;
    })
  );
});