"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ItineraryItemWithProfile } from "@/lib/types";

interface EditActivityModalProps {
  item: ItineraryItemWithProfile;
  tripId: string;
  onClose: () => void;
}

export default function EditActivityModal({
  item,
  tripId,
  onClose,
}: EditActivityModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState(item.title);
  const [url, setUrl] = useState(item.url ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(item.image_url);
  const [removeImage, setRemoveImage] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);
    setRemoveImage(false);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    const supabase = createClient();

    let imageUrl: string | null = item.image_url;

    if (imageFile) {
      const fileExt = imageFile.name.split(".").pop();
      const dayKey = item.day_date ?? "kiv";
      const filePath = `${tripId}/${dayKey}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("activities")
        .upload(filePath, imageFile);

      if (!uploadError) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("activities").getPublicUrl(filePath);
        imageUrl = publicUrl;
      }
    } else if (removeImage) {
      imageUrl = null;
    }

    const { error } = await supabase
      .from("itinerary_items")
      .update({
        title: title.trim(),
        url: url.trim() || null,
        image_url: imageUrl,
      })
      .eq("id", item.id)
      .eq("trip_id", tripId);

    if (error) {
      alert(`Error: ${error.message}`);
      setLoading(false);
      return;
    }

    setLoading(false);
    onClose();
    router.refresh();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-3 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-gray-900">Edit Activity</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
            aria-label="Close"
          >
            <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          autoFocus
        />
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Link (optional)"
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        />

        <div>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="w-full text-xs text-gray-500 file:mr-2 file:rounded-full file:border-0 file:bg-teal-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-teal-600 hover:file:bg-teal-100"
          />
          {imagePreview && !removeImage && (
            <div className="relative mt-2">
              <img src={imagePreview} alt="Preview" className="h-24 w-full rounded-xl object-cover" />
              <button
                type="button"
                onClick={() => {
                  setImagePreview(null);
                  setImageFile(null);
                  setRemoveImage(true);
                }}
                className="absolute top-1 right-1 rounded-full bg-white/90 text-gray-600 w-6 h-6 flex items-center justify-center text-xs shadow"
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="flex-1 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
