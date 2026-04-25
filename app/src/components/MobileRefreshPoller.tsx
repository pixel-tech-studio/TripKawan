"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Mobile browsers suspend WebSockets when the tab is backgrounded or the
// screen locks, so realtime updates miss events. This is a polling safety
// net for touch devices only — desktops keep getting reliable realtime via
// RealtimeRefresh and aren't affected.
//
// Polls every 20s while the page is visible. router.refresh() re-renders
// server components with the latest data; if nothing changed it's a no-op
// from the user's perspective.
const POLL_MS = 20_000;

export default function MobileRefreshPoller() {
  const router = useRouter();

  useEffect(() => {
    const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    console.log("[poller] mounted, isTouch:", isTouch);
    if (!isTouch) return;

    const refresh = (reason: string) => {
      console.log("[poller] refresh:", reason);
      router.refresh();
    };

    const id = setInterval(() => {
      if (!document.hidden) refresh("interval");
    }, POLL_MS);

    const onVisibility = () => {
      if (!document.hidden) refresh("visible");
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  return null;
}
