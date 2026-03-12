const CACHE_NAME = 'asistencia-marello-v1';
const ASSETS = [
  '/asistencia-qr/consulta.html',
  '/asistencia-qr/manifest.json',
  '/asistencia-qr/icon-192.png',
  '/asistencia-qr/icon-512.png'
];

// Instalar y cachear archivos base
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Limpiar caches viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Estrategia: red primero, cache como fallback
self.addEventListener('fetch', e => {
  // No cachear peticiones a Firebase
  if (e.request.url.includes('firestore') || e.request.url.includes('firebase')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
