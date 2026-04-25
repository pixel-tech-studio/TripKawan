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

// Push notification handler. Step 5 will fill this in to:
//   - parse the JSON payload (trip_id, type, title, body)
//   - postMessage to any open clients so they can router.refresh() silently
//   - show a notification if no client is open
self.addEventListener("push", (event) => {
  console.log("[sw] push received", event.data ? event.data.text() : "(no data)");
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
