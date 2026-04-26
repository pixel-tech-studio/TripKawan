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

function BellIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function BellOffIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
      <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
      <path d="M18 8a6 6 0 0 0-9.33-5" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function EnableNotifications() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    console.log("[push] state:", state);
  }, [state]);

  useEffect(() => {
    (async () => {
      try {
        const ua = navigator.userAgent;
        const isIOS = /iPhone|iPad|iPod/.test(ua);
        if (isIOS && !isStandalone()) {
          return setState("needs-install");
        }

        const supported =
          "serviceWorker" in navigator &&
          "PushManager" in window &&
          "Notification" in window;
        if (!supported) return setState("unsupported");

        if (Notification.permission === "denied") return setState("denied");

        const reg = await navigator.serviceWorker.register("/app/sw.js");
        const existing = await reg.pushManager.getSubscription();
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

  // Shared FAB position — bottom-right, above the iOS home-bar safe area.
  const fabPosition =
    "fixed right-5 z-50 bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))]";
  const fabBase =
    "w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-colors disabled:opacity-60";

  // iOS Safari (not yet a PWA) — clicking opens a small inline hint card.
  if (state === "needs-install") {
    return (
      <>
        <button
          onClick={() => setShowHint((s) => !s)}
          aria-label="Notifications: install required"
          className={`${fabPosition} ${fabBase} bg-amber-500 text-white animate-fab-jiggle`}
        >
          <BellIcon />
        </button>
        {showHint && (
          <div
            className={`fixed right-5 z-50 max-w-[calc(100vw-2.5rem)] w-72 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 shadow-xl bottom-[calc(1.25rem+4rem+env(safe-area-inset-bottom,0px))]`}
            role="dialog"
          >
            <p className="leading-snug">
              To get instant updates on iPhone: tap the share icon in Safari,
              then <strong>Add to Home Screen</strong>, and open the app from
              there.
            </p>
            <button
              onClick={() => setShowHint(false)}
              className="mt-2 text-xs font-medium text-amber-700 underline"
            >
              Got it
            </button>
          </div>
        )}
      </>
    );
  }

  if (state === "denied") {
    return (
      <button
        onClick={() => setShowHint((s) => !s)}
        aria-label="Notifications blocked"
        className={`${fabPosition} ${fabBase} bg-gray-300 text-gray-600`}
      >
        <BellOffIcon />
        {showHint && (
          <span className="sr-only">
            Notifications blocked — enable them in your browser settings.
          </span>
        )}
      </button>
    );
  }

  if (state === "on") {
    return (
      <button
        onClick={disable}
        disabled={busy}
        aria-label="Disable notifications"
        title="Notifications on — tap to disable"
        className={`${fabPosition} ${fabBase} bg-emerald-500 hover:bg-emerald-600 text-white`}
      >
        <BellIcon />
      </button>
    );
  }

  // state === "off" — needs the user's tap to grant permission.
  return (
    <button
      onClick={enable}
      disabled={busy}
      aria-label="Enable instant notifications"
      title="Enable instant notifications"
      className={`${fabPosition} ${fabBase} bg-teal-500 hover:bg-teal-600 text-white animate-fab-jiggle`}
    >
      <BellIcon />
    </button>
  );
}
