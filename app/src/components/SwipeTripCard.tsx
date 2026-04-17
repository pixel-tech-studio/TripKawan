"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DatePicker from "@/components/DatePicker";
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
  const [side, setSide] = useState<"left" | "right" | null>(null); // which action panel is revealed
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRemoved, setIsRemoved] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Inline edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(trip.name);
  const [editDestination, setEditDestination] = useState(trip.destination ?? "");
  const [editPax, setEditPax] = useState(trip.expected_pax);
  const [editStart, setEditStart] = useState(trip.start_date ?? "");
  const [editEnd, setEditEnd] = useState(trip.end_date ?? "");
  const [saving, setSaving] = useState(false);

  // Reset confirm state whenever the card snaps closed
  useEffect(() => {
    if (side !== "right") setConfirming(false);
  }, [side]);

  const openEdit = () => {
    setEditName(trip.name);
    setEditDestination(trip.destination ?? "");
    setEditPax(trip.expected_pax);
    setEditStart(trip.start_date ?? "");
    setEditEnd(trip.end_date ?? "");
    snapTo(0, null);
    setEditing(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editDestination.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("trips")
      .update({
        name: editName.trim(),
        destination: editDestination.trim(),
        expected_pax: editPax,
        start_date: editStart || null,
        end_date: editEnd || null,
      })
      .eq("id", trip.id);
    setSaving(false);
    if (error) {
      alert(`Error: ${error.message}`);
      return;
    }
    setEditing(false);
    router.refresh();
  };

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const didSwipe = useRef(false);
  const isScrolling = useRef<boolean | null>(null);

  const snapTo = (x: number, revealedSide: "left" | "right" | null) => {
    setIsSnapping(true);
    setTranslateX(x);
    setSide(revealedSide);
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

    if (side === "right") {
      // Showing delete panel (dragged left) — allow drag back right
      setTranslateX(Math.min(0, -SWIPE_REVEAL + deltaX));
    } else if (side === "left") {
      // Showing edit panel (dragged right) — allow drag back left
      setTranslateX(Math.max(0, SWIPE_REVEAL + deltaX));
    } else {
      if (deltaX < 0) {
        setTranslateX(Math.max(-SWIPE_REVEAL, deltaX));
      } else {
        setTranslateX(Math.min(SWIPE_REVEAL, deltaX));
      }
    }
  };

  const handleTouchEnd = () => {
    if (isScrolling.current) return;

    if (side === "right") {
      translateX > -SWIPE_REVEAL + SWIPE_THRESHOLD ? snapTo(0, null) : snapTo(-SWIPE_REVEAL, "right");
    } else if (side === "left") {
      translateX < SWIPE_REVEAL - SWIPE_THRESHOLD ? snapTo(0, null) : snapTo(SWIPE_REVEAL, "left");
    } else {
      if (translateX < -SWIPE_THRESHOLD) {
        snapTo(-SWIPE_REVEAL, "right");
      } else if (translateX > SWIPE_THRESHOLD) {
        snapTo(SWIPE_REVEAL, "left");
      } else {
        snapTo(0, null);
      }
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const supabase = createClient();
    await supabase.from("trips").delete().eq("id", trip.id);
    setIsRemoved(true);
    router.refresh();
  };

  if (isRemoved) return null;

  if (editing) {
    return (
      <div className="rounded-2xl bg-white p-4 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
            Edit trip
          </span>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center"
            aria-label="Cancel edit"
          >
            <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSaveEdit} className="space-y-2.5">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Trip name"
            required
            autoFocus
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
          <input
            type="text"
            value={editDestination}
            onChange={(e) => setEditDestination(e.target.value)}
            placeholder="Destination"
            required
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">Pax</span>
            <button
              type="button"
              onClick={() => setEditPax((p) => Math.max(1, p - 1))}
              className="w-8 h-8 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
            >
              −
            </button>
            <span className="w-6 text-center text-sm font-semibold">{editPax}</span>
            <button
              type="button"
              onClick={() => setEditPax((p) => p + 1)}
              className="w-8 h-8 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
            >
              +
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Start date</label>
              <DatePicker
                value={editStart}
                onChange={(v) => {
                  setEditStart(v);
                  if (editEnd && editEnd < v) setEditEnd("");
                }}
                placeholder="Start"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">End date</label>
              <DatePicker
                value={editEnd}
                onChange={setEditEnd}
                min={editStart}
                placeholder="End"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-0.5">
            <button
              type="submit"
              disabled={saving || !editName.trim() || !editDestination.trim()}
              className="flex-1 rounded-lg bg-teal-500 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  const dateRange = trip.start_date && trip.end_date
    ? `${formatDate(trip.start_date)} – ${formatDate(trip.end_date)}`
    : trip.start_date
    ? formatDate(trip.start_date)
    : null;

  return (
    <div className={`relative rounded-2xl overflow-hidden shadow-card ${
        translateX > 0 ? "bg-teal-500" : translateX < 0 ? (confirming ? "bg-red-600" : "bg-red-500") : ""
      }`}>
      {/* Edit panel — revealed on right swipe */}
      <button
        type="button"
        onClick={openEdit}
        className="absolute inset-y-0 left-0 w-20 flex flex-col items-center justify-center gap-1 rounded-l-2xl bg-teal-500 text-white"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        <span className="text-[11px] font-semibold">Edit</span>
      </button>

      {/* Delete panel — two-state (Delete → Confirm?) */}
      <div
        className={`absolute inset-y-0 right-0 w-20 flex flex-col items-center justify-center gap-1 rounded-r-2xl transition-colors ${
          confirming ? "bg-red-600" : "bg-red-500"
        }`}
      >
        <button
          onClick={() => (confirming ? handleDelete() : setConfirming(true))}
          disabled={isDeleting}
          className="flex flex-col items-center gap-1 text-white px-2"
        >
          {isDeleting ? (
            <span className="text-xs">...</span>
          ) : confirming ? (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4M12 17h.01" />
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span className="text-[11px] font-bold">Confirm?</span>
            </>
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
          if (didSwipe.current || side) {
            e.preventDefault();
            if (side) snapTo(0, null);
          }
        }}
        onTouchStart={isAdmin ? handleTouchStart : undefined}
        onTouchMove={isAdmin ? handleTouchMove : undefined}
        onTouchEnd={isAdmin ? handleTouchEnd : undefined}
        style={{
          transform: `translateX(${translateX}px)`,
          touchAction: isAdmin ? "pan-y" : undefined,
        }}
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
