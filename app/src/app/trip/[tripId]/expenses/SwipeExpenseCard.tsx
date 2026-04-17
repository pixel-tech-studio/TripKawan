"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ExpenseWithProfile } from "@/lib/types";

interface SwipeExpenseCardProps {
  expense: ExpenseWithProfile;
  canDelete: boolean;
  tripId: string;
  formatAmount: (n: number) => string;
  formatTime: (s: string) => string;
}

const SWIPE_REVEAL = 80;
const SWIPE_THRESHOLD = 40;

export default function SwipeExpenseCard({
  expense,
  canDelete,
  tripId,
  formatAmount,
  formatTime,
}: SwipeExpenseCardProps) {
  const router = useRouter();

  const [translateX, setTranslateX] = useState(0);
  const [side, setSide] = useState<"left" | "right" | null>(null);
  const [isSnapping, setIsSnapping] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRemoved, setIsRemoved] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(expense.item_name);
  const [editAmount, setEditAmount] = useState(String(expense.amount));
  const [saving, setSaving] = useState(false);

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
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    if (isScrolling.current === null && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      isScrolling.current = Math.abs(dy) > Math.abs(dx);
    }
    if (isScrolling.current) return;
    didSwipe.current = true;

    if (side === "right") {
      setTranslateX(Math.min(0, -SWIPE_REVEAL + dx));
    } else if (side === "left") {
      setTranslateX(Math.max(0, SWIPE_REVEAL + dx));
    } else {
      if (dx < 0) {
        setTranslateX(Math.max(-SWIPE_REVEAL, dx));
      } else {
        setTranslateX(Math.min(SWIPE_REVEAL, dx));
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

  if (side !== "right" && confirming) setConfirming(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    const supabase = createClient();
    await supabase.from("expenses").delete().eq("id", expense.id);
    setIsRemoved(true);
    router.refresh();
  };

  const openEdit = () => {
    setEditName(expense.item_name);
    setEditAmount(String(expense.amount));
    snapTo(0, null);
    setEditing(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editAmount) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("expenses")
      .update({
        item_name: editName.trim(),
        amount: parseFloat(editAmount),
      })
      .eq("id", expense.id);
    setSaving(false);
    if (error) {
      alert(`Error: ${error.message}`);
      return;
    }
    setEditing(false);
    router.refresh();
  };

  if (isRemoved) return null;

  if (editing) {
    return (
      <li className="rounded-2xl bg-white p-4 shadow-card">
        <form onSubmit={handleSaveEdit} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              Edit expense
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
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Item name"
            required
            autoFocus
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
          <input
            type="number"
            value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
            placeholder="Amount"
            step="0.01"
            min="0.01"
            required
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
          <div className="flex gap-2 pt-0.5">
            <button
              type="submit"
              disabled={saving || !editName.trim() || !editAmount}
              className="flex-1 rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className={`relative rounded-2xl overflow-hidden shadow-card ${
      translateX > 0 ? "bg-teal-500" : translateX < 0 ? (confirming ? "bg-red-600" : "bg-red-500") : ""
    }`}>
      {/* Edit panel */}
      {canDelete && (translateX !== 0 || side) && (
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
      )}

      {/* Delete panel */}
      {canDelete && (translateX !== 0 || side) && (
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
      )}

      {/* Card */}
      <div
        onTouchStart={canDelete ? handleTouchStart : undefined}
        onTouchMove={canDelete ? handleTouchMove : undefined}
        onTouchEnd={canDelete ? handleTouchEnd : undefined}
        onClick={() => { if (side) snapTo(0, null); }}
        style={{
          transform: `translateX(${translateX}px)`,
          touchAction: canDelete ? "pan-y" : undefined,
        }}
        className={`bg-white p-4 rounded-2xl relative z-10 ${
          isSnapping ? "transition-transform duration-200" : ""
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 min-w-0">
            {expense.profiles?.avatar_url ? (
              <img
                src={expense.profiles.avatar_url}
                alt=""
                className="h-8 w-8 rounded-full mt-0.5 shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-teal-600 font-semibold text-xs mt-0.5 shrink-0">
                {expense.profiles?.display_name?.charAt(0) || "?"}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">
                {expense.item_name}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {expense.profiles?.display_name} &middot; {formatTime(expense.created_at)}
              </p>
            </div>
          </div>
          <span className="text-sm font-semibold text-expense whitespace-nowrap ml-3">
            {formatAmount(Number(expense.amount))}
          </span>
        </div>
        {expense.receipt_url && (
          <a
            href={expense.receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-block mt-2 text-xs text-teal-500 hover:text-teal-600 font-medium"
          >
            View receipt →
          </a>
        )}
      </div>
    </li>
  );
}
