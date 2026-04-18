"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ExpenseWithProfile, Attachment, ExpenseCategory } from "@/lib/types";

interface SwipeExpenseCardProps {
  expense: ExpenseWithProfile;
  canDelete: boolean;
  tripId: string;
}

const formatAmount = (amount: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(amount);

const formatTime = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("en-MY", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const SWIPE_REVEAL = 80;
const SWIPE_THRESHOLD = 40;

export default function SwipeExpenseCard({
  expense,
  canDelete,
  tripId,
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
  const [editCategory, setEditCategory] = useState<ExpenseCategory>(expense.category);
  const [editAttachments, setEditAttachments] = useState<Attachment[]>(expense.attachments || []);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (side !== "right") setConfirming(false);
  }, [side]);

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
    setEditCategory(expense.category);
    setEditAttachments(expense.attachments || []);
    setNewFiles([]);
    snapTo(0, null);
    setEditing(true);
  };

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setNewFiles((prev) => [...prev, ...selected]);
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeExisting = (index: number) => {
    setEditAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const removeNew = (index: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editAmount) return;
    setSaving(true);
    const supabase = createClient();

    const uploaded: Attachment[] = [];
    for (const file of newFiles) {
      const fileExt = file.name.split(".").pop();
      const filePath = `${tripId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(filePath, file);

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from("receipts").getPublicUrl(filePath);
        uploaded.push({ url: publicUrl, name: file.name });
      }
    }

    const allAttachments = [...editAttachments, ...uploaded];

    const { error } = await supabase
      .from("expenses")
      .update({
        item_name: editName.trim(),
        amount: parseFloat(editAmount),
        category: editCategory,
        attachments: allAttachments,
        receipt_url: allAttachments[0]?.url ?? null,
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

  const attachments: Attachment[] = expense.attachments || [];

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
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setEditCategory("personal")}
              className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                editCategory === "personal" ? "bg-teal-500 text-white" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              Personal
            </button>
            <button
              type="button"
              onClick={() => setEditCategory("shared")}
              className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                editCategory === "shared" ? "bg-teal-500 text-white" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              Shared
            </button>
          </div>

          {/* Existing attachments */}
          {editAttachments.length > 0 && (
            <ul className="space-y-1">
              {editAttachments.map((att, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-xs">
                  <a href={att.url} target="_blank" rel="noopener noreferrer" className="truncate text-teal-600 mr-2">
                    {att.name}
                  </a>
                  <button type="button" onClick={() => removeExisting(i)} className="text-gray-400 hover:text-red-500 shrink-0">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* New files to add */}
          {newFiles.length > 0 && (
            <ul className="space-y-1">
              {newFiles.map((file, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg bg-teal-50 px-3 py-1.5 text-xs">
                  <span className="truncate mr-2">{file.name}</span>
                  <button type="button" onClick={() => removeNew(i)} className="text-gray-400 hover:text-red-500 shrink-0">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          <input ref={photoInputRef} type="file" accept="image/*" multiple onChange={addFiles} className="hidden" />
          <input ref={fileInputRef} type="file" multiple onChange={addFiles} className="hidden" />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              Photo
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              File
            </button>
          </div>

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
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {attachments.map((att, i) => (
              <a
                key={i}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs text-teal-500 hover:text-teal-600 font-medium bg-teal-50 px-2 py-0.5 rounded-full"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                </svg>
                {att.name}
              </a>
            ))}
          </div>
        )}
        {!attachments.length && expense.receipt_url && (
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
