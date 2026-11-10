// SmartLivestock Service Worker — Padre Garcia Biosecurity & Field PWA (v5)
// Clean Cache Partitioning: Isolates HTML Navigation from Next.js RSC Wire Streams
const CACHE_VERSION = "v5";
const CACHE_HTML = `smartlivestock-html-${CACHE_VERSION}`;
const CACHE_RSC = `smartlivestock-rsc-${CACHE_VERSION}`;
const CACHE_STATIC = `smartlivestock-static-${CACHE_VERSION}`;
const ALL_CURRENT_CACHES = [CACHE_HTML, CACHE_RSC, CACHE_STATIC];

const OFFLINE_URL = "/offline.html";

// HTML Shells to precache immediately for offline navigation
const PRECACHE_HTML_SHELLS = [
  "/",
  "/farmer",
  "/sibat",
  "/sibat/livestock-registry",
  "/sibat-validation",
  "/production-dashboard",
  "/production-dashboard/history",
  "/report-observation",
  "/livestock-inventory",
  "/livestock-inventory/all",
  "/livestock-inventory/batches",
  "/livestock-inventory/history",
  "/market-prices",
  "/farmer-announcement",
  "/farmer-scheduling",
  "/alerts",
  OFFLINE_URL,
];

// Static core assets & branding to precache immediately
const PRECACHE_STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/manifest.json",
  "/favicon.ico",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/icon-maskable-512x512.png",
  "/icons/apple-touch-icon.png",
  "/images/SmartLivestockEmblem.png",
  "/images/padre-garcia-seal.png",
];

// Service Worker Install — Precache Shells & Assets into respective partitions
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    Promise.all([
      // 1. Static Branding & Icons into CACHE_STATIC
      caches.open(CACHE_STATIC).then((cache) => {
        return Promise.allSettled(
          PRECACHE_STATIC_ASSETS.map((url) =>
            fetch(url, { cache: "reload" })
              .then((res) => {
                if (res.ok) return cache.put(url, res);
              })
              .catch((err) => {
                console.warn(`[SmartLivestock SW] Static precache skipped for ${url}:`, err);
              })
          )
        );
      }),
      // 2. HTML Document Shells strictly as text/html into CACHE_HTML
      caches.open(CACHE_HTML).then((cache) => {
        return Promise.allSettled(
          PRECACHE_HTML_SHELLS.map((url) =>
            fetch(url, {
              headers: { Accept: "text/html,application/xhtml+xml" },
              cache: "reload",
            })
              .then((res) => {
                const cType = res.headers.get("content-type") || "";
                if (res.ok && cType.includes("text/html")) {
                  return cache.put(url, res);
                }
              })
              .catch((err) => {
                console.warn(`[SmartLivestock SW] HTML precache skipped for ${url}:`, err);
              })
          )
        );
      }),
    ])
  );
});

// Service Worker Activate — Clean up outdated caches and claim clients immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (!ALL_CURRENT_CACHES.includes(key)) {
              console.log("[SmartLivestock SW] Purging old cache partition:", key);
              return caches.delete(key);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Match options to ignore query strings and Vary headers when finding offline assets
const MATCH_OPTIONS = { ignoreVary: true, ignoreSearch: true };

// Fetch Strategy:
// 1. Never cache mutations or dynamic API endpoints (/api/, /admin/, /auth/)
// 2. Next.js RSC requests: Network-first -> CACHE_RSC partition (NEVER mixed with HTML)
// 3. Document Navigation requests: Network-first -> CACHE_HTML partition (NEVER returns raw RSC)
// 4. Static assets (_next/, icons, fonts, css, js): Stale-While-Revalidate via CACHE_STATIC
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only intercept GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Exclude external cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Exclude WebSocket connections (Next.js HMR)
  if (request.headers.get("upgrade") === "websocket") return;

  // Never cache dynamic backend APIs, Django Admin, or authentication endpoints
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/admin/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.includes("/token/") ||
    url.pathname.includes("login")
  ) {
    return;
  }

  // --- Category A: Next.js React Server Component (RSC) requests ---
  // When Next.js navigates client-side, it fetches flight data with RSC: 1 or _rsc param.
  // These MUST be strictly saved and served from CACHE_RSC, never from CACHE_HTML!
  const isPrefetch =
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch";
  const isRsc =
    url.searchParams.has("_rsc") ||
    request.headers.get("RSC") === "1" ||
    request.headers.get("accept") === "text/x-component";

  if (isRsc) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Never cache hollow prefetch responses (which only have routing hints, not full page data)
          if (response && response.status === 200 && !isPrefetch) {
            const responseClone = response.clone();
            caches.open(CACHE_RSC).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          if (isPrefetch) {
            return new Response("", { status: 503, statusText: "Offline Prefetch Ignored" });
          }

          const rscCache = await caches.open(CACHE_RSC);
          const cached = await rscCache.match(request, MATCH_OPTIONS);
          if (cached) return cached;

          // Also try matching by pathname if query param differed
          const pathnameMatch = await rscCache.match(url.pathname, MATCH_OPTIONS);
          if (pathnameMatch) return pathnameMatch;

          return new Response("", {
            status: 503,
            statusText: "Offline RSC Unavailable",
            headers: { "Content-Type": "text/plain" },
          });
        })
    );
    return;
  }

  // --- Category B: Full Document HTML Navigation & Pre-warmed HTML requests ---
  // These MUST strictly return text/html documents so the browser never renders raw RSC strings!
  const isHtmlDoc =
    request.mode === "navigate" ||
    ((request.headers.get("accept") || "").includes("text/html") && !isRsc);

  if (isHtmlDoc) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cType = response ? response.headers.get("content-type") || "" : "";
          if (response && response.status === 200 && cType.includes("text/html")) {
            const copy1 = response.clone();
            const copy2 = response.clone();
            caches.open(CACHE_HTML).then((cache) => {
              cache.put(request, copy1);
              cache.put(url.pathname, copy2);
            });
          }
          return response;
        })
        .catch(async () => {
          const htmlCache = await caches.open(CACHE_HTML);

          // Priority candidate list for HTML fallback
          const rawPath = url.pathname;
          const trimmedPath = rawPath.replace(/\/$/, "");
          const candidates = [request, rawPath];
          if (trimmedPath && trimmedPath !== rawPath) candidates.push(trimmedPath);

          if (rawPath.startsWith("/sibat")) {
            candidates.push("/sibat/livestock-registry");
            candidates.push("/sibat");
          }
          if (rawPath.startsWith("/farmer")) {
            candidates.push("/farmer");
          }
          candidates.push("/");
          candidates.push(OFFLINE_URL);

          for (const candidate of candidates) {
            const match = await htmlCache.match(candidate, MATCH_OPTIONS);
            if (match) {
              const matchType = match.headers.get("content-type") || "";
              if (matchType.includes("text/html")) {
                return match;
              }
            }
          }

          const offlinePage = await htmlCache.match(OFFLINE_URL);
          if (offlinePage) return offlinePage;

          // Guaranteed HTML response fallback if all else fails
          return new Response(
            `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Offline | SmartLivestock Padre Garcia</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0c1a11; color: white; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; text-align: center; }
    .card { background: rgba(22, 101, 52, 0.2); border: 1px solid rgba(74, 222, 128, 0.25); color: #f8fafc; padding: 32px 24px; border-radius: 20px; max-width: 420px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); backdrop-filter: blur(10px); }
    h1 { color: #4ade80; font-size: 1.4rem; margin-bottom: 0.5rem; font-weight: 800; }
    p { font-size: 0.9rem; color: #94a3b8; line-height: 1.5; margin-bottom: 1.5rem; }
    button { background: #166534; color: white; border: none; padding: 10px 22px; border-radius: 10px; font-weight: 700; cursor: pointer; transition: background 0.2s; }
    button:hover { background: #15803d; }
  </style>
</head>
<body>
  <div class="card">
    <h1>You are currently offline</h1>
    <p>SmartLivestock could not load this page from cache. Please reconnect to mobile data or Wi-Fi to refresh.</p>
    <button onclick="window.location.reload()">Retry Connection</button>
  </div>
</body>
</html>`,
            { headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
        })
    );
    return;
  }

  // --- Category C: Static Assets (_next/static, images, fonts, icons, CSS, JS) — Stale-While-Revalidate via CACHE_STATIC ---
  if (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname.endsWith(".json")
  ) {
    event.respondWith(
      caches.open(CACHE_STATIC).then((staticCache) => {
        return staticCache.match(request, MATCH_OPTIONS).then((cachedResponse) => {
          const fetchPromise = fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                staticCache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }
});

// Push Notifications — Outbreak warnings, Vaccination schedules & SIBAT approvals
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "SmartLivestock Notification";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "You have a new livestock-related update from Padre Garcia MAO.",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      tag: payload.tag || "smartlivestock",
      data: { url: payload.url || "/notifications" },
    })
  );
});

// Notification Click Handler — Focus or open corresponding app window
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/notifications", self.location.origin);
  if (target.origin !== self.location.origin) return;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        existing.navigate(target.href);
        return existing.focus();
      }
      return clients.openWindow(target.href);
    })
  );
});
