// SmartLivestock Service Worker — Padre Garcia Biosecurity & Field PWA (v3)
const CACHE_NAME = "smartlivestock-pwa-v3";
const OFFLINE_URL = "/offline.html";

// Static core assets & dashboard shells to precache immediately
const PRECACHE_ASSETS = [
  "/",
  "/farmer",
  "/sibat",
  OFFLINE_URL,
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

// Service Worker Install — Precache Shell & Assets immediately
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return Promise.allSettled(
          PRECACHE_ASSETS.map((url) =>
            fetch(url, { cache: "reload" })
              .then((res) => {
                if (res.ok) {
                  return cache.put(url, res);
                }
              })
              .catch((err) => {
                console.warn(`[SmartLivestock SW] Precache skipped for ${url}:`, err);
              })
          )
        );
      })
  );
});

// Service Worker Activate — Clean up outdated caches and take control
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              console.log("[SmartLivestock SW] Purging old cache:", key);
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

// Fetch Strategy:
// 1. Never cache mutations or dynamic API endpoints (/api/, /admin/, /auth/)
// 2. HTML Navigation requests: Network-first -> Exact Cache -> App Shell -> offline.html (with ignoreVary: true)
// 3. Static assets (_next/, icons, images, fonts, rsc): Stale-While-Revalidate (with ignoreVary: true)
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only intercept GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Exclude external cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Exclude WebSocket connections (e.g. Next.js HMR)
  if (request.headers.get("upgrade") === "websocket") return;

  // Never cache dynamic backend APIs, Django Admin, or authentication tokens
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/admin/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.includes("/token/") ||
    url.pathname.includes("login")
  ) {
    return;
  }

  const matchOptions = { ignoreVary: true, ignoreSearch: true };

  // Next.js RSC (React Server Component) client navigation requests
  const isRsc = url.searchParams.has("_rsc") || request.headers.get("RSC") === "1";
  if (isRsc) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request, matchOptions);
          if (cached) return cached;
          return new Response("", { status: 503, statusText: "Offline RSC" });
        })
    );
    return;
  }

  // HTML Navigation requests (Full page loads / refreshes)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy1 = response.clone();
            const copy2 = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy1);
              cache.put(url.pathname, copy2);
            });
          }
          return response;
        })
        .catch(async () => {
          // 1. Try exact requested URL in cache
          const cached = await caches.match(request, matchOptions);
          if (cached) return cached;

          // 2. Try URL pathname (/farmer, /sibat, /)
          const pathnameMatch = await caches.match(url.pathname, matchOptions);
          if (pathnameMatch) return pathnameMatch;

          // 3. Try role-specific dashboard shell fallbacks
          if (url.pathname.startsWith("/farmer")) {
            const farmerShell = await caches.match("/farmer", matchOptions);
            if (farmerShell) return farmerShell;
          }
          if (url.pathname.startsWith("/sibat")) {
            const sibatShell = await caches.match("/sibat", matchOptions);
            if (sibatShell) return sibatShell;
          }

          // 4. Try main app shell
          const appShell = await caches.match("/", matchOptions);
          if (appShell) return appShell;

          // 5. Fallback to offline guidance screen
          const offlinePage = await caches.match(OFFLINE_URL, matchOptions);
          if (offlinePage) return offlinePage;

          return new Response("Offline - SmartLivestock Padre Garcia", {
            headers: { "Content-Type": "text/html" },
          });
        })
    );
    return;
  }

  // Static Assets (_next/, images, fonts, icons) — Stale-While-Revalidate
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
    url.pathname.endsWith(".js")
  ) {
    event.respondWith(
      caches.match(request, matchOptions).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
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
