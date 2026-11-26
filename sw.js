// sw.js : service worker versionné, écrit à la main. Changer VERSION à chaque publication.
const VERSION = '0.5.4';
const CACHE = `entite-mallette-v${VERSION}`;
const MEDIA = ['./audio/tension.mp3', `./voix/intro.mp3?v=${VERSION}`, `./voix/depart.mp3?v=${VERSION}`, './fonts/chakra-petch-latin-500-normal.woff2', './fonts/chakra-petch-latin-700-normal.woff2', './fonts/jetbrains-mono-latin-500-normal.woff2'];
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  `./css/app.css?v=${VERSION}`, `./js/app.js?v=${VERSION}`, `./voix/manifest.json?v=${VERSION}`, './voix/voix.json',
  // chaque module est importé avec ?v=VERSION : un ancien service worker (v0.1.x / v0.2.0-v0.2.3) ne peut plus servir un
  // vieux game.js à un nouvel app.js (cause du blocage à 14 % « code de la mallette » sur le mini PC)
  ...['eye', 'eye-config', 'game', 'panel-config', 'audio', 'sfx', 'voice-manifest', 'preload', 'battery', 'guide'].map((m) => `./js/${m}.js?v=${VERSION}`),
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // prend la main tout de suite : on n'attend jamais qu'app.js survive au démarrage pour envoyer SKIP_WAITING
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
    // anciens caches de l'app principale seulement ; jamais les archives v0.1.5 / v0.1.6 / v0.2.6a (même origine)
    await Promise.all(keys.filter((k) => k.startsWith('entite-mallette-') && !k.startsWith('entite-mallette-v015-') && !k.startsWith('entite-mallette-v016-') && !k.startsWith('entite-mallette-v026a-') && !k.startsWith('entite-mallette-v032-') && !k.startsWith('entite-mallette-v040-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const path = new URL(req.url).pathname;
  // code (.js, .css), manifestes (voix, webmanifest) : réseau d'abord, cache seulement hors ligne
  if (/\.(js|css|json|webmanifest)$/.test(path)) { e.respondWith(networkFirst(req)); return; }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); return res; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  // médias lourds, polices, icônes : cache d'abord (audio/victoire.mp3?v=VERSION y entre au premier chargement, sans précache)
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
function networkFirst(req) {
  return fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then((hit) => hit || Response.error()));
}
