/* EasyPrompter — service worker
   Cachea la carcasa de la app para que funcione sin conexión y sea
   instalable (anclable a la barra de tareas / pantalla de inicio). */

const CACHE = "easyprompter-v2";
const ASSETS = [
  "./",
  "index.html",
  "css/styles.css",
  "js/app.js",
  "js/ticker.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-maskable.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // solo GET del propio origen: nunca interceptar ni cachear terceros
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request, { ignoreSearch: url.pathname.endsWith("/") || url.pathname.endsWith("index.html") })
      .then((hit) => hit || fetch(e.request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }))
  );
});
