"use client";

import { useState, useEffect, useRef } from "react";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  placeholder?: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Drum picker geometry
const ITEM_H = 40;
const VISIBLE_ROWS = 5;
const COLUMN_H = ITEM_H * VISIBLE_ROWS;
const PAD = ITEM_H * Math.floor(VISIBLE_ROWS / 2);

// ── Scroll column (one wheel of the drum) ─────────────────────────────────────
interface ScrollColumnProps {
  items: string[];
  selectedIndex: number;
  onSnap: (idx: number) => void;
  isDisabled?: (idx: number) => boolean;
}

function ScrollColumn({ items, selectedIndex, onSnap, isDisabled }: ScrollColumnProps) {
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);
  const lastSnapped = useRef<number>(selectedIndex);

  // Sync scroll position when selectedIndex changes from outside (initial mount,
  // day-overflow correction, etc). The 4px tolerance avoids re-scrolling when
  // the change came from this column's own onSnap.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = selectedIndex * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 4) {
      lastSnapped.current = selectedIndex;
      el.scrollTo({ top: target, behavior: "auto" });
    }
  }, [selectedIndex]);

  const handleScroll = () => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const idx = Math.max(
        0,
        Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_H))
      );
      if (idx !== lastSnapped.current) {
        lastSnapped.current = idx;
        onSnap(idx);
      }
    }, 90);
  };

  const handleClick = (i: number) => {
    if (isDisabled?.(i)) return;
    ref.current?.scrollTo({ top: i * ITEM_H, behavior: "smooth" });
  };

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      className="flex-1 overflow-y-scroll [&::-webkit-scrollbar]:hidden"
      style={{
        height: COLUMN_H,
        scrollSnapType: "y mandatory",
        scrollbarWidth: "none",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)",
        maskImage:
          "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)",
      }}
    >
      <div style={{ height: PAD }} />
      {items.map((label, i) => {
        const disabled = isDisabled?.(i);
        const sel = i === selectedIndex;
        return (
          <div
            key={i}
            onClick={() => handleClick(i)}
            style={{ height: ITEM_H, scrollSnapAlign: "center" }}
            className={`flex items-center justify-center text-base select-none ${
              disabled
                ? "text-gray-200"
                : sel
                ? "text-gray-900 font-semibold"
                : "text-gray-400"
            }`}
          >
            {label}
          </div>
        );
      })}
      <div style={{ height: PAD }} />
    </div>
  );
}

// ── Drum picker (mobile) ──────────────────────────────────────────────────────
interface DrumPickerProps {
  value: string;
  min?: string;
  onCommit: (v: string) => void;
  onClear: () => void;
}

function DrumPicker({ value, min, onCommit, onClear }: DrumPickerProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = min ? new Date(min + "T00:00:00") : null;

  const seed = value
    ? new Date(value + "T00:00:00")
    : minDate && minDate > today
    ? minDate
    : today;

  const [day, setDay] = useState<number>(seed.getDate());
  const [month, setMonth] = useState<number>(seed.getMonth());
  const [year, setYear] = useState<number>(seed.getFullYear());

  // Year list: current year through current+5. If the seed value is outside
  // that window (e.g. an existing record from a prior year), include it too.
  const currentYear = new Date().getFullYear();
  const baseYears = Array.from({ length: 6 }, (_, i) => currentYear + i);
  const yearList = baseYears.includes(seed.getFullYear())
    ? baseYears
    : [...new Set([seed.getFullYear(), ...baseYears])].sort((a, b) => a - b);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayList = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Clamp day when month/year change shrinks the month
  useEffect(() => {
    if (day > daysInMonth) setDay(daysInMonth);
  }, [day, daysInMonth]);

  const isDayDisabled = minDate
    ? (i: number) => new Date(year, month, i + 1) < minDate
    : undefined;
  const isMonthDisabled = minDate
    ? (i: number) =>
        year < minDate.getFullYear() ||
        (year === minDate.getFullYear() && i < minDate.getMonth())
    : undefined;
  const isYearDisabled = minDate
    ? (i: number) => yearList[i] < minDate.getFullYear()
    : undefined;

  const dayIdx = day - 1;
  const monthIdx = month;
  const yearIdx = Math.max(0, yearList.indexOf(year));

  const handleDone = () => {
    let pick = new Date(year, month, day);
    if (minDate && pick < minDate) pick = new Date(minDate);
    const y = pick.getFullYear();
    const m = String(pick.getMonth() + 1).padStart(2, "0");
    const d = String(pick.getDate()).padStart(2, "0");
    onCommit(`${y}-${m}-${d}`);
  };

  return (
    <>
      <div className="relative">
        {/* Center selection band */}
        <div
          className="absolute inset-x-0 pointer-events-none border-y border-teal-200 bg-teal-50/60"
          style={{ top: PAD, height: ITEM_H }}
        />
        <div className="flex gap-2">
          <ScrollColumn
            items={dayList.map((d) => String(d))}
            selectedIndex={dayIdx}
            onSnap={(i) => setDay(i + 1)}
            isDisabled={isDayDisabled}
          />
          <ScrollColumn
            items={MONTHS_SHORT}
            selectedIndex={monthIdx}
            onSnap={(i) => setMonth(i)}
            isDisabled={isMonthDisabled}
          />
          <ScrollColumn
            items={yearList.map((y) => String(y))}
            selectedIndex={yearIdx}
            onSnap={(i) => setYear(yearList[i])}
            isDisabled={isYearDisabled}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleDone}
        className="w-full mt-5 py-3 text-sm font-semibold text-white bg-teal-500 rounded-2xl hover:bg-teal-600 active:bg-teal-600 transition-colors"
      >
        Done
      </button>

      {value && (
        <button
          type="button"
          onClick={onClear}
          className="w-full mt-2 py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors border-t border-gray-100"
        >
          Clear date
        </button>
      )}
    </>
  );
}

// ── DatePicker (trigger + sheet shell) ────────────────────────────────────────
export default function DatePicker({ value, onChange, min, placeholder = "Select date" }: DatePickerProps) {
  const today = new Date();
  const parseDate = (s: string) => (s ? new Date(s + "T00:00:00") : null);
  const minDate = parseDate(min ?? "");
  const selected = parseDate(value);

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());

  useEffect(() => {
    if (selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
  }, [value]);

  const displayValue = selected
    ? selected.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })
    : "";

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstOffset = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const isDisabled = (day: number) =>
    !!minDate && new Date(viewYear, viewMonth, day) < minDate;

  const isSelected = (day: number) =>
    !!selected &&
    selected.getFullYear() === viewYear &&
    selected.getMonth() === viewMonth &&
    selected.getDate() === day;

  const handleSelect = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    onChange(`${viewYear}-${m}-${d}`);
    setOpen(false);
  };

  const CalendarGrid = () => (
    <>
      {/* Month / Year nav */}
      <div className="flex items-center justify-between mb-5">
        <button type="button" onClick={prevMonth}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-200 transition-colors"
        >
          <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div className="text-center">
          <p className="text-base font-bold text-gray-900">{MONTHS[viewMonth]}</p>
          <p className="text-xs text-gray-400 mt-0.5">{viewYear}</p>
        </div>

        <button type="button" onClick={nextMonth}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-200 transition-colors"
        >
          <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} className="text-center text-[11px] font-semibold text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: firstOffset }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const disabled = isDisabled(day);
          const sel = isSelected(day);
          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => handleSelect(day)}
              className={`mx-auto w-9 h-9 flex items-center justify-center text-sm font-medium rounded-full transition-colors ${
                sel
                  ? "bg-teal-500 text-white shadow-sm"
                  : disabled
                  ? "text-gray-200 cursor-not-allowed"
                  : "text-gray-700 hover:bg-teal-50 active:bg-teal-100"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Clear */}
      {value && (
        <button
          type="button"
          onClick={() => { onChange(""); setOpen(false); }}
          className="w-full mt-4 py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors border-t border-gray-100"
        >
          Clear date
        </button>
      )}
    </>
  );

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-left focus:outline-none focus:ring-2 focus:ring-teal-400"
      >
        {displayValue
          ? <span className="text-gray-900">{displayValue}</span>
          : <span className="text-gray-400">{placeholder}</span>
        }
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end md:items-center md:justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Sheet — bottom sheet on mobile (drum), centered card on desktop (calendar) */}
          <div className="
            relative bg-white shadow-2xl
            rounded-t-3xl px-5 pt-4 pb-[env(safe-area-inset-bottom,20px)] w-full
            md:rounded-2xl md:w-auto md:min-w-[320px] md:max-w-sm md:px-6 md:py-6
          ">
            {/* Handle — mobile only */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 md:hidden" />

            {/* Mobile: drum */}
            <div className="md:hidden">
              <DrumPicker
                value={value}
                min={min}
                onCommit={(v) => { onChange(v); setOpen(false); }}
                onClear={() => { onChange(""); setOpen(false); }}
              />
            </div>

            {/* Desktop: calendar */}
            <div className="hidden md:block">
              <CalendarGrid />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
