"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface SetAlbumLinkProps {
  tripId: string;
  currentUrl: string;
}

export default function SetAlbumLink({ tripId, currentUrl }: SetAlbumLinkProps) {
  const [isEditing, setIsEditing] = useState(!currentUrl);
  const [url, setUrl] = useState(currentUrl);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    await supabase
      .from("trips")
      .update({ photo_album_url: url.trim() || null })
      .eq("id", tripId);

    setLoading(false);
    setIsEditing(false);
    router.refresh();
  };

  if (!isEditing && currentUrl) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        Change album link
      </button>
    );
  }

  return (
    <form onSubmit={handleSave} className="w-full max-w-sm mx-auto space-y-3">
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://photos.app.goo.gl/..."
        className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        autoFocus
      />
      <div className="flex gap-3">
        {currentUrl && (
          <button
            type="button"
            onClick={() => {
              setUrl(currentUrl);
              setIsEditing(false);
            }}
            className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="flex-1 rounded-2xl bg-teal-500 py-3 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
