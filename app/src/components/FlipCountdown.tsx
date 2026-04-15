"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

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
interface FlipCountdownProps {
  targetDate: string; // YYYY-MM-DD
  endDate?: string | null;
  tripName: string;
  tripId: string;
  memberCount?: number;
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
  });
}

export default function FlipCountdown({ targetDate, endDate, tripName, tripId, memberCount }: FlipCountdownProps) {
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    const calc = () => {
      const target = new Date(targetDate + "T00:00:00");
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      setDays(Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86400000)));
    };
    calc();

    // Schedule first recompute at next local midnight + 1s, then daily.
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

  if (days === null) return null;

  const digits = String(Math.min(days, 999)).padStart(3, "0").split("");
  const dateLabel = endDate
    ? `${formatDate(targetDate)} – ${formatDate(endDate)}`
    : formatDate(targetDate);

  return (
    <div className="px-4 mb-6">
      <Link href={`/trip/${tripId}/itinerary`} className="block rounded-3xl bg-gray-900 px-6 py-5 active:opacity-80 transition-opacity">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
          {days === 0 ? "🎉 Today!" : days === 1 ? "✈️ Tomorrow!" : "Next trip in"}
        </p>

        <div className="flex gap-2 w-full mb-5">
          {digits.map((d, i) => (
            <FlipTile key={i} digit={d} mountDelay={i * 100} />
          ))}
        </div>

        {/* Trip name */}
        <p className="text-base font-bold text-white leading-snug mb-1">{tripName}</p>

        {/* Date · members */}
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
