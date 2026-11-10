// SmartLivestock Service Worker — Padre Garcia Biosecurity & Field PWA
const CACHE_NAME = "smartlivestock-pwa-v1";
const OFFLINE_URL = "/offline.html";

// Static core assets to precache immediately
const PRECACHE_ASSETS = [
  "/",
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

// Service Worker Install — Precache Shell & Assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS).catch((err) => {
          console.warn("[SmartLivestock SW] Precache warning:", err);
        });
      })
      .then(() => self.skipWaiting())
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
              return caches.delete(key);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch Strategy:
// 1. Never cache mutations or dynamic API endpoints (/api/, /admin/, /auth/)
// 2. HTML Navigation requests: Network-first -> Cache -> offline.html
// 3. Static assets (_next/static, icons, images, fonts): Stale-While-Revalidate
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only intercept GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Exclude external cross-origin requests
  if (url.origin !== self.location.origin) return;

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

  // Navigation requests (HTML pages)
  if (request.mode === "navigate") {
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
          const cached = await caches.match(request);
          if (cached) return cached;
          const offlinePage = await caches.match(OFFLINE_URL);
          if (offlinePage) return offlinePage;
          return new Response("Offline - SmartLivestock Padre Garcia", {
            headers: { "Content-Type": "text/html" },
          });
        })
    );
    return;
  }

  // Static Assets (_next/static, images, fonts, icons) — Stale-While-Revalidate
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
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
