/* Ritmo — service worker
   Red primero para que las actualizaciones lleguen enseguida;
   si no hay conexión se sirve la copia en caché (funciona offline). */

const CACHE = "ritmo-v2";
const ASSETS = [
  "./",
  "index.html",
  "css/styles.css",
  "js/app.js",
  "js/store.js",
  "js/config.js",
  "vendor/supabase.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-maskable.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("ritmo-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // solo GET del propio origen dentro de /ritmo/: nunca la API ni terceros
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(new URL("./", self.location).pathname)) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
