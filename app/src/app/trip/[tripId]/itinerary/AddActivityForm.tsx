"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface AddActivityFormProps {
  tripId: string;
  dayDate: string;
}

export default function AddActivityForm({
  tripId,
  dayDate,
}: AddActivityFormProps) {
  const [isOpen, setIsOpen] = useState(false);
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

    const { error } = await supabase.from("itinerary_items").insert({
      trip_id: tripId,
      day_date: dayDate,
      title: title.trim(),
      url: url.trim() || null,
      image_url: imageUrl,
      suggested_by: user.id,
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
    setIsOpen(false);
    setLoading(false);
    router.refresh();
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="mt-2 text-xs text-teal-500 hover:text-teal-600 font-medium"
      >
        + Add activity
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded-2xl bg-white p-3 shadow-card space-y-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Snorkeling at Marine Park"
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        autoFocus
      />
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Link (optional) e.g. https://booking.com/..."
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
      />
      <div>
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
            className="mt-2 h-24 w-full rounded-xl object-cover"
          />
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-50"
        >
          {loading ? "Adding..." : "Add"}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setImagePreview(null);
            setImageFile(null);
          }}
          className="rounded-xl px-3 py-2 text-sm text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
