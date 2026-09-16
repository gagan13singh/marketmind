/**
 * MarketMind Service Worker
 *
 * Strategy:
 *  - App shell (HTML, JS, CSS, fonts): cache-first after first load.
 *  - API routes (/api/*): network-first — market data must be fresh.
 *  - Static assets (/icons/*, /manifest.json): cache-first forever.
 *
 * Why hand-written instead of Workbox:
 *  No extra build dependency needed; Next.js already handles asset hashing so
 *  a version bump here is sufficient to invalidate everything.
 */

const CACHE_VERSION = "marketmind-v3";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;

const PRECACHE_URLS = ["/", "/dashboard", "/screener", "/backtest", "/offline"];

// ── Install: cache the app shell ────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

// ── Activate: prune old caches ───────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("marketmind-") && k !== STATIC_CACHE && k !== API_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch: route-based strategy ──────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests (not external CDN, analytics, etc.)
  if (url.origin !== self.location.origin) return;

  // API routes: network-first, short cache for offline fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(event.request, API_CACHE));
    return;
  }

  // Next.js build chunks (_next/static): cache-first, they're content-hashed
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  // App shell navigation: network-first, fallback to cached or /offline
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then((cached) => cached ?? caches.match("/offline")),
      ),
    );
    return;
  }

  // Everything else (icons, fonts, images): cache-first
  event.respondWith(cacheFirst(event.request, STATIC_CACHE));
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? new Response(JSON.stringify({ error: "Offline — no cached data available." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}
