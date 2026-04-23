"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface AddActivityFormProps {
  tripId: string;
  dayDate: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function AddActivityForm({
  tripId,
  dayDate,
  isOpen,
  onClose,
}: AddActivityFormProps) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    let imageUrl: string | null = null;

    if (imageFile) {
      const fileExt = imageFile.name.split(".").pop();
      const filePath = `${tripId}/${dayDate}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("activities")
        .upload(filePath, imageFile);

      if (!uploadError) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("activities").getPublicUrl(filePath);
        imageUrl = publicUrl;
      }
    }

    // Get current max sort_order for this day to append at end
    const { data: maxRow } = await supabase
      .from("itinerary_items")
      .select("sort_order")
      .eq("trip_id", tripId)
      .eq("day_date", dayDate)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxRow?.sort_order ?? -1) + 1;

    const { error } = await supabase.from("itinerary_items").insert({
      trip_id: tripId,
      day_date: dayDate,
      title: title.trim(),
      url: url.trim() || null,
      image_url: imageUrl,
      suggested_by: user.id,
      sort_order: nextOrder,
    });

    if (error) {
      console.error("Add activity failed:", error);
      alert(`Error: ${error.message}`);
      setLoading(false);
      return;
    }

    setTitle("");
    setUrl("");
    setImageFile(null);
    setImagePreview(null);
    onClose();
    setLoading(false);
    router.refresh();
  };

  if (!isOpen) return null;

  const handleCancel = () => {
    setImagePreview(null);
    setImageFile(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={handleCancel} />

      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white px-5 pb-24 pt-4 animate-slideUp">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-300" />

        <h3 className="text-lg font-semibold mb-4">Add Activity</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Snorkeling at Marine Park"
              required
              autoFocus
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Link (optional)
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://booking.com/..."
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Image (optional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full text-xs text-gray-500 file:mr-2 file:rounded-full file:border-0 file:bg-teal-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-teal-600 hover:file:bg-teal-100"
            />
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Preview"
                className="mt-2 h-32 w-full rounded-xl object-cover"
              />
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex-1 rounded-2xl bg-teal-500 py-3 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add Activity"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
