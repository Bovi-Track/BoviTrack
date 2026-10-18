/* Los archivos y la versión se inyectan desde el build de Vite. */
const CACHE = 'bovitrack-app-__VERSION__'
const FILES = __FILES__

// RF-TR-01: conserva la aplicación completa después de una instalación online exitosa.
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)))
})

// Conserva solo la versión activa; una actualización espera a que cierren las pestañas anteriores.
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((key) => key.startsWith('bovitrack-app-') && key !== CACHE)
    .map((key) => caches.delete(key)))).then(() => self.clients.claim()))
})

// Atiende archivos de la app y navegación; no almacena respuestas de Supabase ni otros orígenes.
self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')))
  } else if (FILES.includes(url.pathname)) {
    event.respondWith(caches.match(request, { ignoreVary: true }).then((cached) => cached || fetch(request)))
  }
})
