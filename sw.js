const CACHE_NAME = 'asistencia-marello-v4';
const ASSETS = [
  '/asistencia-qr/consulta.html',
  '/asistencia-qr/apoderado.html',
  '/asistencia-qr/manifest.json',
  '/asistencia-qr/icon-192.png',
  '/asistencia-qr/icon-512.png',
  '/asistencia-qr/img/logo-colegio.png',
  '/asistencia-qr/img/apple-icon.png',
  '/asistencia-qr/img/banner-login-1.png',
  '/asistencia-qr/img/banner-login-2.png',
  '/asistencia-qr/img/banner-login-3.png',
  '/asistencia-qr/img/banner-login-4.png',
  '/asistencia-qr/img/banner-login-5.png',
  '/asistencia-qr/img/banner-default-1.jpg',
  '/asistencia-qr/img/banner-default-2.jpg',
  '/asistencia-qr/img/banner-default-3.jpg',
  '/asistencia-qr/img/banner-default-4.jpg',
  '/asistencia-qr/img/banner-default-5.jpg'
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
