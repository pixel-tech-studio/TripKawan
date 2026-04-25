"use client";

import { useEffect } from "react";

// Registers the service worker that handles push notifications.
// File is served from public/sw.js → /app/sw.js (basePath is /app).
// Default scope is /app/, which covers the whole app.
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      console.log("[sw] not supported in this browser");
      return;
    }
    navigator.serviceWorker
      .register("/app/sw.js")
      .then((reg) => console.log("[sw] registered, scope:", reg.scope))
      .catch((err) => console.error("[sw] register failed", err));
  }, []);

  return null;
}
