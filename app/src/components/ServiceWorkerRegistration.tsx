"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Registers the service worker that handles push notifications, and
// listens for "push-refresh" messages from the SW so the visible page
// refreshes its data the moment a push arrives.
export default function ServiceWorkerRegistration() {
  const router = useRouter();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      console.log("[sw] not supported in this browser");
      return;
    }
    navigator.serviceWorker
      .register("/app/sw.js")
      .then((reg) => console.log("[sw] registered, scope:", reg.scope))
      .catch((err) => console.error("[sw] register failed", err));

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "push-refresh") {
        console.log("[sw] push-refresh");
        router.refresh();
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, [router]);

  return null;
}
