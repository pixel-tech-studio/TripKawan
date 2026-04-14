"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Trip } from "@/lib/types";

interface SwipeTripCardProps {
  trip: Trip;
  status: { label: string; color: string } | null;
  memberCount: number;
  isAdmin: boolean;
  isOngoing?: boolean;
}

const SWIPE_REVEAL = 80;
const SWIPE_THRESHOLD = 40;

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-MY", {
    month: "short",
    day: "numeric",
  });
}

export default function SwipeTripCard({
  trip,
  status,
  memberCount,
  isAdmin,
  isOngoing,
}: SwipeTripCardProps) {
  const router = useRouter();
  const [translateX, setTranslateX] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRemoved, setIsRemoved] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const didSwipe = useRef(false);
  const isScrolling = useRef<boolean | null>(null);

  const snapTo = (x: number, revealed: boolean) => {
    setIsSnapping(true);
    setTranslateX(x);
    setIsRevealed(revealed);
    setTimeout(() => setIsSnapping(false), 200);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    didSwipe.current = false;
    isScrolling.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;

    if (isScrolling.current === null && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
      isScrolling.current = Math.abs(deltaY) > Math.abs(deltaX);
    }

    if (isScrolling.current) return;
    didSwipe.current = true;

    if (isRevealed) {
      setTranslateX(Math.min(0, -SWIPE_REVEAL + deltaX));
    } else {
      if (deltaX > 0) return;
      setTranslateX(Math.max(-SWIPE_REVEAL, deltaX));
    }
  };

  const handleTouchEnd = () => {
    if (isScrolling.current) return;

    if (isRevealed) {
      translateX > -SWIPE_REVEAL + SWIPE_THRESHOLD ? snapTo(0, false) : snapTo(-SWIPE_REVEAL, true);
    } else {
      translateX < -SWIPE_THRESHOLD ? snapTo(-SWIPE_REVEAL, true) : snapTo(0, false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${trip.name}"? This cannot be undone.`)) return;
    setIsDeleting(true);
    const supabase = createClient();
    await supabase.from("trips").delete().eq("id", trip.id);
    setIsRemoved(true);
    router.refresh();
  };

  if (isRemoved) return null;

  const dateRange = trip.start_date && trip.end_date
    ? `${formatDate(trip.start_date)} – ${formatDate(trip.end_date)}`
    : trip.start_date
    ? formatDate(trip.start_date)
    : null;

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-card">
      {/* Delete panel */}
      <div className="absolute inset-y-0 right-0 w-20 bg-red-500 flex flex-col items-center justify-center gap-1 rounded-r-2xl">
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex flex-col items-center gap-1 text-white px-2"
        >
          {isDeleting ? (
            <span className="text-xs">...</span>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
              <span className="text-[11px] font-semibold">Delete</span>
            </>
          )}
        </button>
      </div>

      {/* Card */}
      <Link
        href={`/trip/${trip.id}`}
        onClick={(e) => {
          if (didSwipe.current || isRevealed) {
            e.preventDefault();
            if (isRevealed) snapTo(0, false);
          }
        }}
        onTouchStart={isAdmin ? handleTouchStart : undefined}
        onTouchMove={isAdmin ? handleTouchMove : undefined}
        onTouchEnd={isAdmin ? handleTouchEnd : undefined}
        style={{ transform: `translateX(${translateX}px)` }}
        className={`block bg-white p-4 rounded-2xl relative z-10 ${
          isSnapping ? "transition-transform duration-200" : ""
        }`}
      >
        {/* Row 1: Trip name + status badge */}
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-base leading-tight">{trip.name}</h3>
          {status && (
            <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.color}`}>
              {status.label}
            </span>
          )}
        </div>

        {/* Row 2: Destination + live dot */}
        {(trip.destination || isOngoing) && (
          <div className="flex items-center justify-between mt-1">
            {trip.destination
              ? <span className="text-xs text-gray-400 truncate">{trip.destination}</span>
              : <span />
            }
            {isOngoing && (
              <div className="shrink-0 flex items-center gap-1.5 ml-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide">Live</span>
              </div>
            )}
          </div>
        )}

        {/* Row 3: Date range + member count */}
        {(dateRange || memberCount > 0) && (
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
            {dateRange && <span className="shrink-0">{dateRange}</span>}
            {memberCount > 0 && (
              <span className="flex items-center gap-1 shrink-0">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                </svg>
                {memberCount}
              </span>
            )}
          </div>
        )}
      </Link>
    </div>
  );
}
