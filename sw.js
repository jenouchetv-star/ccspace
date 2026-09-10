/* Chike's Creative Space - service worker.
   Single-page app served with a path-based fallback to index.html (see
   .claude/serve.py locally, or an equivalent rewrite rule in production).
   Every navigation therefore resolves to the same shell document, which is
   why navigation requests are cached under one fixed key rather than one
   entry per route.

   Bump CACHE_VERSION on every deploy that changes cached files. That is
   the whole update mechanism: a new version number means a new cache name,
   which means install() re-fetches everything and activate() deletes the
   old caches, so nobody is left running stale HTML against a new build. */
const CACHE_VERSION = "ccs-v2";
const SHELL_CACHE = CACHE_VERSION + "-shell";
const RUNTIME_CACHE = CACHE_VERSION + "-runtime";

const INDEX_URL = "/index.html";
const OFFLINE_URL = "/offline.html";

/* The app shell: enough to render the homepage and navigate while offline. */
const PRECACHE_URLS = [
  "/",
  INDEX_URL,
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/assets/brand/logo.webp",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
  "/assets/icons/icon-maskable-192.png",
  "/assets/icons/icon-maskable-512.png",
  "/assets/icons/apple-touch-icon.png",
  "/assets/vendor/lucide.js"
];

self.addEventListener("install", (event) => {
  /* No self.skipWaiting() here - a new worker installing while someone
     is mid-form on an old page must sit in "waiting" until that page
     opts in (the "Refresh" button below, or SKIP_WAITING). Calling it
     unconditionally on every install is what caused a silent
     controllerchange -> location.reload() at a random moment on any
     open tab, wiping in-progress form input with no warning - the exact
     thing the message-handler comment below already documented as
     unwanted, but this line was doing anyway. A brand-new visitor with
     no prior service worker is unaffected: the browser activates a
     first install on its own with nothing else to wait for. */
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

/* A page tells us it is ready for the new version (see the "Refresh" button
   on the update banner in index.html) rather than the service worker
   forcing a reload no one asked for. */
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isStaticAsset(url){
  return /^\/(assets|games|books)\//.test(url.pathname)
    || /\.(?:png|jpg|jpeg|webp|svg|gif|ico|woff2?|ttf)$/i.test(url.pathname);
}

function isGoogleFonts(url){
  return url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
}

/* Cache-first: fine for versioned images, icons, fonts, and other static
   files that do not change under a stable URL. */
async function cacheFirst(request){
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res && res.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, res.clone());
    }
    return res;
  } catch (err) {
    return cached || Response.error();
  }
}

/* Network-first: pages and the app shell should always try for the latest
   build first, so a deploy is visible on the very next load rather than
   waiting for a cache to expire. The cached shell is only a fallback for
   when the network is unavailable. */
async function networkFirstNavigation(request){
  try {
    const res = await fetch(request);
    if (res && res.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(INDEX_URL, res.clone());
    }
    return res;
  } catch (err) {
    const cache = await caches.open(SHELL_CACHE);
    const shell = await cache.match(INDEX_URL);
    return shell || cache.match(OFFLINE_URL) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;               /* forms write to localStorage, nothing to cache */

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  /* Full-page navigations: /, /create, /play/online, ... all resolve to
     the same shell document - but a game or book's own file, loaded in the
     sandboxed <iframe id="gamestage-frame">, is ALSO a "navigate"-mode
     request (an iframe's own navigation counts as one). Its destination is
     "iframe", not "document", which is what tells the two apart. Without
     this check, opening a game would run networkFirstNavigation() below,
     which unconditionally caches its response under the fixed key
     INDEX_URL - overwriting the real index.html shell in SHELL_CACHE with
     that game's markup, so any later navigation that falls back to cache
     (a network hiccup) would serve the game in place of the app shell on
     every route, /admin included. */
  if (request.mode === "navigate" && request.destination === "iframe") return;

  if (request.mode === "navigate" && sameOrigin) {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (sameOrigin && isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (isGoogleFonts(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  /* Everything else (YouTube embeds, external cover art, Amazon links,
     analytics-shaped requests, and anything cross-origin we do not
     recognise) passes straight through, uncached. */
});
