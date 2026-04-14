"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface JoinButtonProps {
  tripId: string;
}

export default function JoinButton({ tripId }: JoinButtonProps) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const router = useRouter();

  const handleJoin = async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push(`/login?next=/join/${tripId}`);
      return;
    }

    const { error } = await supabase.from("trip_members").insert({
      trip_id: tripId,
      user_id: user.id,
      status: "pending",
    });

    if (error) {
      if (error.code === "23505") {
        // Already requested
        setSent(true);
      }
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="rounded-2xl bg-teal-50 p-4 text-sm text-teal-700">
        Request sent! The trip admin will review it shortly.
      </div>
    );
  }

  return (
    <button
      onClick={handleJoin}
      disabled={loading}
      className="w-full rounded-2xl bg-teal-500 py-3 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50 transition-colors shadow-card"
    >
      {loading ? "Sending request..." : "Request to Join"}
    </button>
  );
}
