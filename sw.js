const CACHE_NAME = 'cekbon-cache-v11';
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  // Memaksa service worker yang baru diinstal untuk segera aktif
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Mengambil kendali semua klien segera setelah aktif
      self.clients.claim(),
      // Menghapus cache lama
      caches.keys().then((keys) => Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      ))
    ])
  );
});

self.addEventListener('fetch', (event) => {
  // Strategi: Network First untuk navigasi (index.html) agar selalu dapat versi terbaru jika online
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  
  // Strategi: Cache First untuk aset lain (gambar, manifest, dll)
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});