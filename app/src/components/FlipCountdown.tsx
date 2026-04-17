"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DatePicker from "@/components/DatePicker";
import type { Trip } from "@/lib/types";

// ── Timing constants ──────────────────────────────────────────────────────────
const SEQ_HALF = 80;   // ms per half-flip during the count-up sequence
const SEQ_STEP = SEQ_HALF * 2 + 10; // total ms per digit step (~170ms)
const NORM_HALF = 250; // ms per half-flip for live digit changes

// ── FlipTile ──────────────────────────────────────────────────────────────────
interface FlipTileProps {
  digit: string;
  compact?: boolean;
  mountDelay?: number; // ms before this tile starts its count-up
}

function FlipTile({ digit, compact = false, mountDelay = 0 }: FlipTileProps) {
  const w  = compact ? 26 : 68;
  const h  = compact ? 36 : 90;
  const fs = compact ? 30 : 76;

  const [current, setCurrent] = useState("0");
  const [next,    setNext]    = useState("0");
  const [phase,   setPhase]   = useState<"idle" | "fold" | "reveal">("idle");
  const [animDur, setAnimDur] = useState(`${SEQ_HALF}ms`);

  const mountedRef = useRef(false);
  const prevDigit  = useRef(digit); // tracks the last prop value after mount

  // ── On-mount count-up sequence ────────────────────────────────────────────
  useEffect(() => {
    const target = parseInt(digit, 10);
    const timers: ReturnType<typeof setTimeout>[] = [];

    const scheduleFlip = (toVal: number, delay: number) => {
      timers.push(setTimeout(() => {
        setNext(String(toVal));
        setPhase("fold");
      }, delay));
      timers.push(setTimeout(() => {
        setCurrent(String(toVal));
        setPhase("reveal");
      }, delay + SEQ_HALF));
      timers.push(setTimeout(() => {
        setPhase("idle");
      }, delay + SEQ_HALF * 2));
    };

    if (target === 0) {
      // Digit is 0 — do one visual flip anyway so it doesn't look skipped
      timers.push(setTimeout(() => {
        setPhase("fold");
        timers.push(setTimeout(() => setPhase("reveal"), SEQ_HALF));
        timers.push(setTimeout(() => setPhase("idle"),   SEQ_HALF * 2));
      }, mountDelay));
    } else {
      for (let i = 1; i <= target; i++) {
        scheduleFlip(i, mountDelay + (i - 1) * SEQ_STEP);
      }
    }

    // Switch to normal timing after the sequence finishes
    const doneAt = mountDelay + Math.max(0, target - 1) * SEQ_STEP + SEQ_HALF * 2 + 50;
    timers.push(setTimeout(() => {
      setAnimDur(`${NORM_HALF}ms`);
      mountedRef.current = true;
    }, doneAt));

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Live digit changes (after mount) ─────────────────────────────────────
  useEffect(() => {
    if (!mountedRef.current) return;
    if (digit === prevDigit.current) return;
    prevDigit.current = digit;

    setNext(digit);
    setPhase("fold");
    const t1 = setTimeout(() => { setCurrent(digit); setPhase("reveal"); }, NORM_HALF);
    const t2 = setTimeout(() => setPhase("idle"), NORM_HALF * 2);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [digit]);

  // Compact: fixed pixel sizes. Full: flex-1 + aspect-ratio + container-query font.
  const radius = compact ? "0.375rem" : "0.75rem";
  const tileStyle: React.CSSProperties = compact
    ? { width: w, height: h, position: "relative" }
    : { flex: 1, aspectRatio: "68/90", position: "relative", containerType: "inline-size" };
  const fontStyle: React.CSSProperties = compact
    ? { fontSize: fs, lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: -1 }
    : { fontSize: "112cqi", lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" };

  return (
    <div className="select-none" style={tileStyle}>
      {/* Card background */}
      <div className="absolute inset-0" style={{ background: "#1c1c1e", borderRadius: radius, boxShadow: "0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)" }} />

      {/* Static top half */}
      <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: "50%", borderRadius: `${radius} ${radius} 0 0` }}>
        <div className="absolute inset-0 flex items-end justify-center overflow-hidden" style={{ background: "#2a2a2c" }}>
          <span className="font-bold text-white" style={{ ...fontStyle, transform: "translateY(50%)" }}>
            {current}
          </span>
        </div>
      </div>

      {/* Static bottom half */}
      <div className="absolute inset-x-0 bottom-0 overflow-hidden" style={{ height: "50%", borderRadius: `0 0 ${radius} ${radius}` }}>
        <div className="absolute inset-0 flex items-start justify-center overflow-hidden" style={{ background: "#1c1c1e" }}>
          <span className="font-bold text-white" style={{ ...fontStyle, transform: "translateY(-50%)" }}>
            {current}
          </span>
        </div>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 40%)" }} />
      </div>

      {/* Fold flap (old digit folds down) */}
      {phase === "fold" && (
        <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: "50%", borderRadius: `${radius} ${radius} 0 0`, transformOrigin: "bottom", animation: `flipFold ${animDur} ease-in forwards`, zIndex: 10 }}>
          <div className="absolute inset-0 flex items-end justify-center overflow-hidden" style={{ background: "#2a2a2c" }}>
            <span className="font-bold text-white" style={{ ...fontStyle, transform: "translateY(50%)" }}>
              {current}
            </span>
          </div>
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.4))" }} />
        </div>
      )}

      {/* Reveal flap (new digit swings up) */}
      {phase === "reveal" && (
        <div className="absolute inset-x-0 bottom-0 overflow-hidden" style={{ height: "50%", borderRadius: `0 0 ${radius} ${radius}`, transformOrigin: "top", animation: `flipReveal ${animDur} ease-out forwards`, zIndex: 10 }}>
          <div className="absolute inset-0 flex items-start justify-center overflow-hidden" style={{ background: "#1c1c1e" }}>
            <span className="font-bold text-white" style={{ ...fontStyle, transform: "translateY(-50%)" }}>
              {next}
            </span>
          </div>
        </div>
      )}

      {/* Centre split line */}
      <div className="absolute inset-x-0 pointer-events-none" style={{ top: "50%", height: 2, background: "#000", opacity: 0.7, zIndex: 20 }} />
    </div>
  );
}

// ── CompactFlipDigits (inside trip cards) ─────────────────────────────────────
interface CompactFlipDigitsProps {
  days: number;
}

export function CompactFlipDigits({ days }: CompactFlipDigitsProps) {
  const digits = String(Math.min(days, 999)).padStart(3, "0").split("");
  return (
    <div className="flex items-center gap-1">
      {digits.map((d, i) => (
        <FlipTile key={i} digit={d} compact mountDelay={i * 60} />
      ))}
    </div>
  );
}

// ── Full-size countdown card (links to itinerary) ─────────────────────────────
const SWIPE_REVEAL = 80;
const SWIPE_THRESHOLD = 40;

interface FlipCountdownProps {
  trip: Trip;
  memberCount?: number;
  isAdmin: boolean;
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
  });
}

export default function FlipCountdown({ trip, memberCount, isAdmin }: FlipCountdownProps) {
  const router = useRouter();
  const [days, setDays] = useState<number | null>(null);

  // Swipe state
  const [translateX, setTranslateX] = useState(0);
  const [side, setSide] = useState<"left" | "right" | null>(null);
  const [isSnapping, setIsSnapping] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const didSwipe = useRef(false);
  const isScrolling = useRef<boolean | null>(null);

  // Inline edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(trip.name);
  const [editDestination, setEditDestination] = useState(trip.destination ?? "");
  const [editPax, setEditPax] = useState(trip.expected_pax);
  const [editStart, setEditStart] = useState(trip.start_date ?? "");
  const [editEnd, setEditEnd] = useState(trip.end_date ?? "");
  const [saving, setSaving] = useState(false);

  const targetDate = trip.start_date!;
  const endDate = trip.end_date;

  useEffect(() => {
    const calc = () => {
      const target = new Date(targetDate + "T00:00:00");
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      setDays(Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86400000)));
    };
    calc();

    const msUntilMidnight = (() => {
      const next = new Date();
      next.setHours(24, 0, 1, 0);
      return next.getTime() - Date.now();
    })();

    let intervalId: ReturnType<typeof setInterval> | undefined;
    const timeoutId = setTimeout(() => {
      calc();
      intervalId = setInterval(calc, 86400000);
    }, msUntilMidnight);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [targetDate]);

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
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    if (isScrolling.current === null && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      isScrolling.current = Math.abs(dy) > Math.abs(dx);
    }
    if (isScrolling.current) return;
    didSwipe.current = true;

    if (side === "left") {
      setTranslateX(Math.max(0, SWIPE_REVEAL + dx));
    } else {
      if (dx > 0) setTranslateX(Math.min(SWIPE_REVEAL, dx));
    }
  };

  const handleTouchEnd = () => {
    if (isScrolling.current) return;
    if (side === "left") {
      translateX < SWIPE_REVEAL - SWIPE_THRESHOLD ? snapTo(0, null) : snapTo(SWIPE_REVEAL, "left");
    } else {
      if (translateX > SWIPE_THRESHOLD) {
        snapTo(SWIPE_REVEAL, "left");
      } else {
        snapTo(0, null);
      }
    }
  };

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

  if (days === null) return null;

  const digits = String(Math.min(days, 999)).padStart(3, "0").split("");
  const dateLabel = endDate
    ? `${formatDate(targetDate)} – ${formatDate(endDate)}`
    : formatDate(targetDate);

  if (editing) {
    return (
      <div className="px-4 mb-6">
        <div className="rounded-3xl bg-gray-900 px-6 py-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              Edit trip
            </span>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="w-6 h-6 rounded-full hover:bg-gray-800 flex items-center justify-center"
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
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            <input
              type="text"
              value={editDestination}
              onChange={(e) => setEditDestination(e.target.value)}
              placeholder="Destination"
              required
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">Pax</span>
              <button
                type="button"
                onClick={() => setEditPax((p) => Math.max(1, p - 1))}
                className="w-8 h-8 rounded-full border border-gray-700 text-gray-400 hover:bg-gray-800"
              >
                −
              </button>
              <span className="w-6 text-center text-sm font-semibold text-white">{editPax}</span>
              <button
                type="button"
                onClick={() => setEditPax((p) => p + 1)}
                className="w-8 h-8 rounded-full border border-gray-700 text-gray-400 hover:bg-gray-800"
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
                className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:text-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 mb-6">
      <div className="relative rounded-3xl overflow-hidden">
        {/* Edit panel — revealed on right swipe */}
        {isAdmin && (translateX !== 0 || side) && (
          <button
            type="button"
            onClick={openEdit}
            className="absolute inset-y-0 left-0 w-20 flex flex-col items-center justify-center gap-1 rounded-l-3xl bg-teal-500 text-white"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span className="text-[11px] font-semibold">Edit</span>
          </button>
        )}

        <Link
          href={`/trip/${trip.id}/itinerary`}
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
          className={`block rounded-3xl bg-gray-900 px-6 py-5 relative z-10 ${
            isSnapping ? "transition-transform duration-200" : ""
          }`}
        >
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
            {days === 0 ? "🎉 Today!" : days === 1 ? "✈️ Tomorrow!" : "Next trip in"}
          </p>

          <div className="flex gap-2 w-full mb-5">
            {digits.map((d, i) => (
              <FlipTile key={i} digit={d} mountDelay={i * 100} />
            ))}
          </div>

          <p className="text-base font-bold text-white leading-snug mb-1">{trip.name}</p>

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{dateLabel}</span>
            {memberCount != null && memberCount > 0 && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                  </svg>
                  {memberCount}
                </span>
              </>
            )}
          </div>
        </Link>
      </div>

      <style>{`
        @keyframes flipFold {
          from { transform: rotateX(0deg); }
          to   { transform: rotateX(-90deg); }
        }
        @keyframes flipReveal {
          from { transform: rotateX(90deg); }
          to   { transform: rotateX(0deg); }
        }
      `}</style>
    </div>
  );
}
