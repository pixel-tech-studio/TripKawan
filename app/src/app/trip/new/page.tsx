"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DatePicker from "@/components/DatePicker";

export default function NewTripPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [expectedPax, setExpectedPax] = useState(2);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !destination.trim()) return;

    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    // Create the trip
    const { data: trip, error } = await supabase
      .from("trips")
      .insert({
        name: name.trim(),
        destination: destination.trim(),
        expected_pax: expectedPax,
        start_date: startDate || null,
        end_date: endDate || null,
        admin_user_id: user.id,
      })
      .select()
      .single();

    if (error || !trip) {
      console.error("Trip creation failed:", error);
      alert(`Error: ${error?.message || "Trip not created"}`);
      setLoading(false);
      return;
    }

    // Add creator as a member
    await supabase.from("trip_members").insert({
      trip_id: trip.id,
      user_id: user.id,
    });

    // Go to questionnaire setup instead of straight to itinerary
    router.push(`/trip/${trip.id}/setup`);
  };

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 pt-3 pb-3">
        <div className="flex items-center gap-3 min-h-[38px]">
          <button
            onClick={() => router.back()}
            className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            aria-label="Back"
          >
            <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-base font-bold text-gray-900 leading-tight">Create a Trip</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 px-4 pt-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Trip Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Family Redang Trip"
            required
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Destination
          </label>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="e.g. Pulau Redang, Terengganu"
            required
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Expected Pax
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setExpectedPax((p) => Math.max(1, p - 1))}
              className="w-10 h-10 rounded-full border border-gray-200 text-gray-500 text-lg font-medium hover:bg-gray-50 transition-colors"
            >
              −
            </button>
            <span className="w-12 text-center text-lg font-semibold text-gray-800">
              {expectedPax}
            </span>
            <button
              type="button"
              onClick={() => setExpectedPax((p) => p + 1)}
              className="w-10 h-10 rounded-full border border-gray-200 text-gray-500 text-lg font-medium hover:bg-gray-50 transition-colors"
            >
              +
            </button>
            <span className="text-sm text-gray-400">people</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Start Date
            </label>
            <DatePicker
              value={startDate}
              onChange={(v) => {
                setStartDate(v);
                if (endDate && endDate < v) setEndDate("");
              }}
              placeholder="Start"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              End Date
            </label>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              min={startDate}
              placeholder="End"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !name.trim() || !destination.trim()}
          className="w-full rounded-2xl bg-teal-500 py-3 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50 transition-colors"
        >
          {loading ? "Creating..." : "Create Trip →"}
        </button>
      </form>
    </div>
  );
}
