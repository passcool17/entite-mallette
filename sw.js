// sw.js : service worker versionné, écrit à la main. Changer VERSION à chaque publication.
const VERSION = '0.2.2';
const CACHE = `entite-mallette-v${VERSION}`;
const MEDIA = ['./audio/tension.mp3', './voix/intro.mp3', './voix/depart.mp3', './fonts/chakra-petch-latin-500-normal.woff2', './fonts/chakra-petch-latin-700-normal.woff2', './fonts/jetbrains-mono-latin-500-normal.woff2'];
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './css/app.css?v=0.2.2', './js/app.js?v=0.2.2', './voix/manifest.json', './voix/voix.json',
  './js/eye.js', './js/eye-config.js', './js/game.js', './js/panel-config.js', './js/audio.js', './js/sfx.js', './js/voice-manifest.js', './js/preload.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  // code : forcé depuis le réseau ; médias : cache HTTP accepté (déjà téléchargés par l'écran de chargement)
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all([
    c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))),
    c.addAll(MEDIA),
  ])));
});
self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    // anciens caches de l'app principale seulement ; jamais les archives v0.1.5 / v0.1.6 (même origine)
    await Promise.all(keys.filter((k) => k.startsWith('entite-mallette-') && !k.startsWith('entite-mallette-v015-') && !k.startsWith('entite-mallette-v016-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const path = new URL(req.url).pathname;
  if (path.endsWith('/voix/manifest.json') || path.endsWith('/voix/voix.json')) {
    // manifeste des voix : réseau d'abord, pour voir arriver les nouveaux mp3 (mp3Ready) sans changer le code
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; }).catch(() => caches.match(req)));
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); return res; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
