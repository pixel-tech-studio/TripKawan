// TripKawan service worker.
//
// Served at /app/sw.js (basePath is /app), so the default scope is /app/ —
// which covers the entire Next app. Don't move this file out of public/.

self.addEventListener("install", (event) => {
  console.log("[sw] install");
  // Take over immediately on first install instead of waiting for all tabs
  // using the previous SW (or no SW) to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[sw] activate");
  // Claim any already-open pages so they get controlled by this SW without
  // a reload.
  event.waitUntil(self.clients.claim());
});

// Push notification handler.
//
// Server payload shape: { title, body, url? }. We:
//   1. postMessage every open client so they can router.refresh() and pick
//      up the new data immediately — no waiting on realtime / polling.
//   2. Show a system notification regardless. The user may or may not have
//      a tab open; this guarantees they see something.
self.addEventListener("push", (event) => {
  let payload = { title: "TripKawan", body: "", url: "/app" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        client.postMessage({ type: "push-refresh" });
      }
      await self.registration.showNotification(payload.title, {
        body: payload.body,
        data: { url: payload.url },
        icon: "/app/api/pwa-icon/192",
        badge: "/app/api/pwa-icon/192",
      });
    })()
  );
});

// When the user taps a notification, focus the existing app window if any,
// otherwise open the trip page.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const url = event.notification.data?.url ?? "/app";
      for (const client of allClients) {
        if ("focus" in client) {
          client.navigate?.(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })()
  );
});
