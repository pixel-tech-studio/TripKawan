"use client";

import { useState, useEffect } from "react";

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
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Sheet — bottom sheet on mobile, centered card on desktop */}
          <div className="
            relative bg-white shadow-2xl
            rounded-t-3xl px-5 pt-4 pb-[env(safe-area-inset-bottom,20px)] w-full
            md:rounded-2xl md:w-auto md:min-w-[320px] md:max-w-sm md:px-6 md:py-6
          ">
            {/* Handle — mobile only */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 md:hidden" />

            <CalendarGrid />
          </div>
        </div>
      )}
    </>
  );
}
