"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface AddMemberFormProps {
  tripId: string;
}

export default function AddMemberForm({ tripId }: AddMemberFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError("");
    const supabase = createClient();

    // Look up user by email
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .single();

    if (!profile) {
      setError("No user found with that email. They need to sign in to TripKawan first.");
      setLoading(false);
      return;
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from("trip_members")
      .select("id")
      .eq("trip_id", tripId)
      .eq("user_id", profile.id)
      .single();

    if (existing) {
      setError("This person is already a member of this trip.");
      setLoading(false);
      return;
    }

    // Add them
    const { error: insertError } = await supabase
      .from("trip_members")
      .insert({ trip_id: tripId, user_id: profile.id });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setEmail("");
    setIsOpen(false);
    setLoading(false);
    router.refresh();
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full rounded-2xl bg-teal-500 py-3 text-sm font-semibold text-white hover:bg-teal-600 transition-colors shadow-card mb-4"
      >
        + Add Member
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card mb-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Member&apos;s email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. family@gmail.com"
            required
            autoFocus
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>
        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setError("");
            }}
            className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="flex-1 rounded-2xl bg-teal-500 py-3 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
          >
            {loading ? "Adding..." : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
}
