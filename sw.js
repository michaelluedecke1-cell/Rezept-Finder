const CACHE_NAME = 'rezept-app-v2'; // Version hochgezählt, um Cache zu aktualisieren
const ASSETS = [
    '/',
    '/index.html',
    '/settings.html', // <-- Neue Seite hinzugefügt
    '/app.js',
    '/manifest.json'
];

// Install Event - Cacht die statischen Dateien
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate Event - Löscht alte Caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
});

// Fetch Event - Lade aus dem Cache, wenn verfügbar, sonst Netzwerk
self.addEventListener('fetch', event => {
    // API Requests an Groq nicht cachen
    if (event.request.url.includes('api.groq.com')) {
        return; 
    }

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                return cachedResponse || fetch(event.request);
            })
    );
});