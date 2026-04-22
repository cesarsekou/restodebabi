// Service Worker — Le Porc de Chez Nous
const CACHE_NAME = 'chariow-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/banner_promo.jpg',
  '/menu-porc/Brochettes.jpeg',
  '/menu-porc/Pork Fats.jpeg',
  '/menu-porc/porc braise.jpeg',
  '/menu-porc/porc super.jpeg',
  '/menu-porc/c.jpeg',
  '/accompagnements/Alloco.jpeg',
  '/accompagnements/riz.jpeg',
  '/accompagnements/Ignames bouillies.jpeg',
  "/accompagnements/L'attiéké (semoule de manioc).jpeg"
];

// Install — cache les fichiers essentiels
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — nettoie les anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — Network First pour les API, Cache First pour les assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ne pas cacher les requêtes Supabase (API)
  if (url.hostname.includes('supabase')) return;

  // Ne pas cacher les requêtes POST
  if (event.request.method !== 'GET') return;

  event.respondWith(
    // Stratégie: Network first, fallback cache
    fetch(event.request)
      .then(response => {
        // Mettre en cache la réponse fraîche
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
