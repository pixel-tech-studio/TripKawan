"use client";

import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ItineraryItemWithProfile } from "@/lib/types";

interface ActivityCardProps {
  item: ItineraryItemWithProfile;
  isAdmin: boolean;
  tripId: string;
  isOverlay?: boolean;
}

const SWIPE_REVEAL = 80;
const SWIPE_THRESHOLD = 40;

export default function ActivityCard({
  item,
  isAdmin,
  tripId,
  isOverlay,
}: ActivityCardProps) {
  const router = useRouter();
  const isKiv = item.day_date === null;

  const [swipeX, setSwipeX] = useState(0);
  const [side, setSide] = useState<"left" | "right" | null>(null);
  const [snapping, setSnapping] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [editing, setEditing] = useState(false);

  // Inline edit state
  const [editTitle, setEditTitle] = useState(item.title);
  const [editUrl, setEditUrl] = useState(item.url ?? "");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(item.image_url);
  const [editRemoveImage, setEditRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const didSwipe = useRef(false);
  const axisLocked = useRef<"h" | "v" | null>(null);

  useEffect(() => {
    if (editing) titleInputRef.current?.focus();
  }, [editing]);

  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { item },
    disabled: !isAdmin,
  });

  const snapTo = (x: number, rev: "left" | "right" | null) => {
    setSnapping(true);
    setSwipeX(x);
    setSide(rev);
    setTimeout(() => setSnapping(false), 200);
  };

  const close = () => snapTo(0, null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    didSwipe.current = false;
    axisLocked.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    if (!axisLocked.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      axisLocked.current = Math.abs(dy) > Math.abs(dx) ? "v" : "h";
    }
    if (axisLocked.current !== "h") return;

    didSwipe.current = true;

    if (side === "right") {
      setSwipeX(Math.min(0, -SWIPE_REVEAL + dx));
    } else if (side === "left") {
      setSwipeX(Math.max(0, SWIPE_REVEAL + dx));
    } else {
      if (dx < 0) {
        setSwipeX(Math.max(-SWIPE_REVEAL, dx));
      } else {
        setSwipeX(Math.min(SWIPE_REVEAL, dx));
      }
    }
  };

  const handleTouchEnd = () => {
    if (!didSwipe.current) return;
    if (side === "right") {
      swipeX > -SWIPE_REVEAL + SWIPE_THRESHOLD ? snapTo(0, null) : snapTo(-SWIPE_REVEAL, "right");
    } else if (side === "left") {
      swipeX < SWIPE_REVEAL - SWIPE_THRESHOLD ? snapTo(0, null) : snapTo(SWIPE_REVEAL, "left");
    } else {
      if (swipeX < -SWIPE_THRESHOLD) {
        snapTo(-SWIPE_REVEAL, "right");
      } else if (swipeX > SWIPE_THRESHOLD) {
        snapTo(SWIPE_REVEAL, "left");
      } else {
        snapTo(0, null);
      }
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this activity permanently?")) return;
    const supabase = createClient();
    await supabase
      .from("itinerary_items")
      .delete()
      .eq("id", item.id)
      .eq("trip_id", tripId);
    setRemoved(true);
    router.refresh();
  };

  const handleEdit = () => {
    close();
    setEditTitle(item.title);
    setEditUrl(item.url ?? "");
    setEditImageFile(null);
    setEditImagePreview(item.image_url);
    setEditRemoveImage(false);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setEditImageFile(file);
    setEditRemoveImage(false);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setEditImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;

    setSaving(true);
    const supabase = createClient();
    let imageUrl: string | null = item.image_url;

    if (editImageFile) {
      const fileExt = editImageFile.name.split(".").pop();
      const dayKey = item.day_date ?? "kiv";
      const filePath = `${tripId}/${dayKey}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("activities")
        .upload(filePath, editImageFile);
      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from("activities").getPublicUrl(filePath);
        imageUrl = publicUrl;
      }
    } else if (editRemoveImage) {
      imageUrl = null;
    }

    const { error } = await supabase
      .from("itinerary_items")
      .update({
        title: editTitle.trim(),
        url: editUrl.trim() || null,
        image_url: imageUrl,
      })
      .eq("id", item.id)
      .eq("trip_id", tripId);

    setSaving(false);
    if (error) {
      alert(`Error: ${error.message}`);
      return;
    }
    setEditing(false);
    router.refresh();
  };

  if (removed) return null;

  const dndTransform = transform ? CSS.Translate.toString(transform) : undefined;
  const cardStyle: React.CSSProperties = {
    transform: [dndTransform, swipeX !== 0 ? `translateX(${swipeX}px)` : ""].filter(Boolean).join(" ") || undefined,
    transition: snapping && !isDragging ? "transform 200ms ease" : (transition || undefined),
    touchAction: isAdmin ? "pan-y" : undefined,
  };

  const cardBase = isKiv
    ? "rounded-2xl bg-amber-50 border border-amber-200"
    : "rounded-2xl bg-white shadow-card";

  const draggingClass = isDragging && !isOverlay ? "opacity-30" : "";

  if (isOverlay) {
    return (
      <li className={`${cardBase} overflow-hidden shadow-xl rotate-1 scale-[1.02]`}>
        {item.image_url && (
          <img src={item.image_url} alt={item.title} className="w-full h-32 object-cover" />
        )}
        <div className="p-3">
          <p className="font-medium text-sm">{item.title}</p>
        </div>
      </li>
    );
  }

  if (editing) {
    return (
      <li className={`${cardBase} overflow-hidden`}>
        <form onSubmit={handleSave} className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              Edit activity
            </span>
            <button
              type="button"
              onClick={cancelEdit}
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
            ref={titleInputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
          <input
            type="url"
            value={editUrl}
            onChange={(e) => setEditUrl(e.target.value)}
            placeholder="Link (optional)"
            className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
          <input
            type="file"
            accept="image/*"
            onChange={handleEditImageChange}
            className="w-full text-xs text-gray-500 file:mr-2 file:rounded-full file:border-0 file:bg-teal-50 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-teal-600 hover:file:bg-teal-100"
          />
          {editImagePreview && !editRemoveImage && (
            <div className="relative">
              <img src={editImagePreview} alt="Preview" className="h-20 w-full rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => {
                  setEditImagePreview(null);
                  setEditImageFile(null);
                  setEditRemoveImage(true);
                }}
                className="absolute top-1 right-1 rounded-full bg-white/90 text-gray-600 w-5 h-5 flex items-center justify-center text-xs shadow"
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          )}
          <div className="flex gap-2 pt-0.5">
            <button
              type="submit"
              disabled={saving || !editTitle.trim()}
              className="flex-1 rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
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
    <li
      className={`relative rounded-2xl ${swipeX !== 0 || side || snapping ? "overflow-hidden" : ""}`}
    >
        {/* Edit panel — revealed on right swipe */}
        {isAdmin && (
          <button
            onClick={handleEdit}
            className="absolute inset-y-0 left-0 w-20 bg-teal-500 flex flex-col items-center justify-center gap-1 rounded-l-2xl text-white"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span className="text-[11px] font-semibold">Edit</span>
          </button>
        )}

        {/* Delete panel — revealed on left swipe */}
        {isAdmin && (
          <div className="absolute inset-y-0 right-0 w-20 bg-red-500 flex flex-col items-center justify-center gap-1 rounded-r-2xl">
            <button
              onClick={handleDelete}
              className="flex flex-col items-center gap-1 text-white px-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
              <span className="text-[11px] font-semibold">Delete</span>
            </button>
          </div>
        )}

        {/* Card — swipe handlers here, drag handle separately */}
        <div
          ref={setNodeRef}
          style={cardStyle}
          className={`${cardBase} ${draggingClass} overflow-hidden transition-opacity duration-200 relative z-10`}
          onTouchStart={isAdmin ? handleTouchStart : undefined}
          onTouchMove={isAdmin ? handleTouchMove : undefined}
          onTouchEnd={isAdmin ? handleTouchEnd : undefined}
          onClick={() => { if (side) close(); }}
        >
          {item.image_url && (
            <img
              src={item.image_url}
              alt={item.title}
              className="w-full h-32 object-cover"
            />
          )}
          <div className="p-3">
            <div className="flex items-start gap-2">
              {/* Drag handle — touch-none so browser doesn't scroll on it */}
              {isAdmin && (
                <span
                  {...listeners}
                  className="touch-none cursor-grab active:cursor-grabbing text-gray-200 shrink-0 mt-0.5 select-none"
                  style={{ fontSize: 18, lineHeight: 1 }}
                >
                  ⠿
                </span>
              )}

              <div className="min-w-0 flex-1">
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={`font-medium text-sm underline break-words ${
                      isKiv
                        ? "text-amber-700 hover:text-amber-800 decoration-amber-300"
                        : "text-teal-600 hover:text-teal-700 decoration-teal-300"
                    }`}
                  >
                    {item.title}
                  </a>
                ) : (
                  <p className={`font-medium text-sm ${isKiv ? "text-amber-800" : ""}`}>
                    {item.title}
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-xs text-gray-400">
                    by {item.profiles.display_name}
                  </p>
                  {item.source === "ai" && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-400 border border-purple-100">
                      ✨ AI
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
    </li>
  );
}
