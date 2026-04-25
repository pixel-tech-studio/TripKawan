"use client";

import { useEffect, useState } from "react";

type State =
  | "loading"
  | "unsupported"
  | "needs-install"
  | "denied"
  | "off"
  | "on";

// Web Push uses a base64url-encoded public key, but PushManager.subscribe
// wants a raw Uint8Array. Convert here.
function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function isStandalone(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari exposes navigator.standalone instead of display-mode.
  const navAny = navigator as Navigator & { standalone?: boolean };
  return navAny.standalone === true;
}

export default function EnableNotifications() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    console.log("[push] state:", state);
  }, [state]);

  // On mount, figure out what state we're in.
  useEffect(() => {
    (async () => {
      try {
        const ua = navigator.userAgent;
        const isIOS = /iPhone|iPad|iPod/.test(ua);
        if (isIOS && !isStandalone()) {
          console.log("[push] → needs-install (iOS, not standalone)");
          return setState("needs-install");
        }

        const supported =
          "serviceWorker" in navigator &&
          "PushManager" in window &&
          "Notification" in window;
        console.log("[push] supported:", supported);
        if (!supported) return setState("unsupported");

        console.log("[push] permission:", Notification.permission);
        if (Notification.permission === "denied") return setState("denied");

        // Don't use serviceWorker.ready — it waits for the current page
        // to be controlled by an active SW, but our basePath /app means
        // the home page URL (/app) is outside scope /app/, so it never
        // becomes controlled and ready hangs forever. register() returns
        // the registration object directly; push subscriptions live on
        // that and work regardless of which pages are controlled.
        console.log("[push] registering SW");
        const reg = await navigator.serviceWorker.register("/app/sw.js");
        console.log("[push] SW registered, pushManager:", !!reg.pushManager);

        const existing = await reg.pushManager.getSubscription();
        console.log("[push] existing subscription:", existing?.endpoint ?? null);
        setState(existing ? "on" : "off");
      } catch (err) {
        console.error("[push] setup threw:", err);
      }
    })();
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }

      const reg = await navigator.serviceWorker.register("/app/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });

      const json = sub.toJSON();
      const res = await fetch("/app/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...json, userAgent: navigator.userAgent }),
      });
      if (!res.ok) {
        // Roll back the browser-side subscription if the server failed to
        // store it — otherwise the user's device is "subscribed" with no
        // record on our side and will never receive pushes.
        await sub.unsubscribe();
        throw new Error("server rejected subscription");
      }
      setState("on");
    } catch (err) {
      console.error("[push] enable failed", err);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/app/sw.js");
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/app/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } catch (err) {
      console.error("[push] disable failed", err);
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading" || state === "unsupported") return null;

  if (state === "needs-install") {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
        To get instant updates on iPhone, tap the share icon in Safari, then{" "}
        <strong>Add to Home Screen</strong> and open from there.
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600">
        Notifications are blocked. Enable them in your browser/system settings
        to get instant updates.
      </div>
    );
  }

  if (state === "on") {
    return (
      <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm">
        <span className="text-emerald-800">Notifications on for this device</span>
        <button
          onClick={disable}
          disabled={busy}
          className="text-emerald-700 underline disabled:opacity-50"
        >
          Disable
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={enable}
      disabled={busy}
      className="w-full rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 px-4 py-3 text-sm font-medium text-white transition-colors"
    >
      {busy ? "Enabling…" : "Enable instant notifications"}
    </button>
  );
}
