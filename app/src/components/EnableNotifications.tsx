"use client";

import { useEffect, useRef, useState } from "react";

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
  // Ref so the auto-prompt gesture listener can call the latest enable()
  // without re-binding every render.
  const enableRef = useRef<() => void>(() => {});

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

  // Keep the ref pointed at the latest enable() so the auto-prompt
  // listener (registered once when state flips to "off") always calls the
  // current closure.
  useEffect(() => {
    enableRef.current = enable;
  });

  // Auto-trigger on the user's first gesture once state settles to "off".
  // Browsers require a user-gesture to call Notification.requestPermission(),
  // so we can't prompt on page load — but we can hook the very next
  // pointerdown anywhere on the page. localStorage flag prevents
  // re-prompting across reloads if the user dismissed the OS dialog.
  useEffect(() => {
    if (state !== "off") return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem("push-auto-prompted") === "1") return;

    const handler = () => {
      localStorage.setItem("push-auto-prompted", "1");
      enableRef.current();
    };
    document.addEventListener("pointerdown", handler, {
      once: true,
      capture: true,
    });
    return () => {
      document.removeEventListener("pointerdown", handler, { capture: true });
    };
  }, [state]);

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
  // Toggle pill: 96×48, inner 40px circle slides to the side that matches
  // the current state (left=off, right=on), like a mini ON/OFF switch.
  const pillBase =
    "h-12 w-24 rounded-full shadow-lg flex items-center transition-colors disabled:opacity-60";

  // ON pill — circle on the right, "ON" text on the left.
  const OnPill = ({ tone }: { tone: "teal" | "emerald" }) => (
    <div
      className={`flex items-center justify-between h-full w-full pl-3 pr-1 ${
        tone === "teal" ? "text-white" : "text-white"
      }`}
    >
      <span className="text-sm font-bold tracking-wider">ON</span>
      <span className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
        <BellIcon
          className={`w-5 h-5 ${tone === "teal" ? "text-teal-500" : "text-emerald-500"}`}
        />
      </span>
    </div>
  );

  // OFF pill — circle (with optional jiggle) on the left, label on the right.
  const OffPill = ({
    label,
    tone,
    jiggle,
    icon,
  }: {
    label: string;
    tone: "gray" | "amber";
    jiggle: boolean;
    icon: "bell" | "bell-off";
  }) => (
    <div
      className={`flex items-center justify-between h-full w-full pl-1 pr-3 ${
        tone === "gray" ? "text-gray-600" : "text-amber-700"
      }`}
    >
      <span
        className={`w-10 h-10 rounded-full bg-white flex items-center justify-center ${
          jiggle ? "animate-fab-jiggle" : ""
        }`}
      >
        {icon === "bell" ? (
          <BellIcon
            className={`w-5 h-5 ${tone === "gray" ? "text-gray-500" : "text-amber-500"}`}
          />
        ) : (
          <BellOffIcon
            className={`w-5 h-5 ${tone === "gray" ? "text-gray-500" : "text-amber-500"}`}
          />
        )}
      </span>
      <span className="text-sm font-bold tracking-wider">{label}</span>
    </div>
  );

  // iOS Safari (not yet a PWA) — clicking opens a small inline hint card.
  if (state === "needs-install") {
    return (
      <>
        <button
          onClick={() => setShowHint((s) => !s)}
          aria-label="Notifications: install required"
          className={`${fabPosition} ${pillBase} bg-amber-100 hover:bg-amber-200`}
        >
          <OffPill label="OFF" tone="amber" jiggle icon="bell" />
        </button>
        {showHint && (
          <div
            className="fixed right-5 z-50 max-w-[calc(100vw-2.5rem)] w-72 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 shadow-xl bottom-[calc(1.25rem+4rem+env(safe-area-inset-bottom,0px))]"
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
        aria-label="Notifications blocked — change in browser settings"
        title="Notifications blocked — change in browser settings"
        className={`${fabPosition} ${pillBase} bg-gray-200`}
        disabled
      >
        <OffPill label="OFF" tone="gray" jiggle={false} icon="bell-off" />
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
        className={`${fabPosition} ${pillBase} bg-teal-500 hover:bg-teal-600`}
      >
        <OnPill tone="teal" />
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
      className={`${fabPosition} ${pillBase} bg-gray-200 hover:bg-gray-300`}
    >
      <OffPill label="OFF" tone="gray" jiggle icon="bell" />
    </button>
  );
}
