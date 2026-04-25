"use client";

import { useEffect, useRef } from "react";

// Wraps the entire top sticky region of trip-scoped pages in ONE sticky
// container. Pages can portal additional rows (DAY tab bar, active-day
// label, etc.) into the #trip-extra-sticky slot, so everything stacks
// inside a single sticky element with no sub-pixel gaps between rows.
//
// The container's measured height is published as the CSS variable
// --trip-chrome-h so day sections can use scroll-margin-top to land below
// the sticky when navigated to via anchor.
export default function TripStickyChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const h = el.getBoundingClientRect().height;
      document.documentElement.style.setProperty(
        "--trip-chrome-h",
        `${Math.round(h)}px`
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="sticky top-0 z-40 bg-white border-b border-gray-100"
    >
      {children}
      <div id="trip-extra-sticky" />
    </div>
  );
}
