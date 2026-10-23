self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "SmartLivestock notification";
  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body || "You have a new livestock-related update.",
    icon: "/images/species-cattle.jpg",
    badge: "/images/species-cattle.jpg",
    tag: payload.tag || "smartlivestock",
    data: { url: payload.url || "/notifications" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/notifications", self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      existing.navigate(target.href);
      return existing.focus();
    }
    return clients.openWindow(target.href);
  }));
});
