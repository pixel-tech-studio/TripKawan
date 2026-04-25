import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Trip } from "@/lib/types";
import LogoutButton from "@/components/LogoutButton";
import SwipeTripCard from "@/components/SwipeTripCard";
import FlipCountdown from "@/components/FlipCountdown";
import EnableNotifications from "@/components/EnableNotifications";

// ── Status badge helper ───────────────────────────────────────────────────────
function getTripStatus(trip: Trip) {
  if (!trip.start_date) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(trip.start_date + "T00:00:00");
  const end = trip.end_date ? new Date(trip.end_date + "T00:00:00") : null;

  if (end && now > end)
    return { label: "Completed", color: "text-gray-400 bg-gray-100" };
  if (now >= start)
    return { label: "Ongoing", color: "text-emerald-600 bg-emerald-50" };

  const daysLeft = Math.ceil((start.getTime() - now.getTime()) / 86400000);
  if (daysLeft === 0) return { label: "Today!", color: "text-teal-600 bg-teal-50" };
  if (daysLeft === 1) return { label: "Tomorrow", color: "text-teal-600 bg-teal-50" };
  return { label: `In ${daysLeft} days`, color: "text-teal-600 bg-teal-50" };
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ label, dot }: { label: string; dot?: "green" }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {dot === "green" && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
      )}
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
        {label}
      </h2>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function TripsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .single();

  // Get trips the user is a member of (with their role)
  const { data: memberships } = await supabase
    .from("trip_members")
    .select("trip_id, role")
    .eq("user_id", user.id)
    .eq("status", "approved");

  const tripIds = memberships?.map((m) => m.trip_id) || [];
  const adminTripIds = new Set(
    (memberships || [])
      .filter((m) => m.role === "admin")
      .map((m) => m.trip_id)
  );

  let trips: Trip[] = [];
  let memberCountMap: Record<string, number> = {};

  if (tripIds.length > 0) {
    const { data } = await supabase
      .from("trips")
      .select("*")
      .in("id", tripIds)
      .returns<Trip[]>();
    trips = data || [];

    const { data: allMembers } = await supabase
      .from("trip_members")
      .select("trip_id")
      .in("trip_id", tripIds)
      .eq("status", "approved");

    if (allMembers) {
      for (const m of allMembers) {
        memberCountMap[m.trip_id] = (memberCountMap[m.trip_id] || 0) + 1;
      }
    }
  }

  // ── Group trips ─────────────────────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const unplanned: Trip[] = [];
  const ongoing: Trip[] = [];
  const upcoming: Array<{ trip: Trip; daysUntil: number }> = [];
  const completed: Trip[] = [];

  for (const trip of trips) {
    if (!trip.start_date) {
      unplanned.push(trip);
      continue;
    }
    const start = new Date(trip.start_date + "T00:00:00");
    const end = trip.end_date ? new Date(trip.end_date + "T00:00:00") : null;

    if (end && today > end) {
      completed.push(trip);
    } else if (today >= start) {
      ongoing.push(trip);
    } else {
      const daysUntil = Math.ceil((start.getTime() - today.getTime()) / 86400000);
      upcoming.push({ trip, daysUntil });
    }
  }

  // Sort upcoming by closest date first
  upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

  // Next trip for the top countdown widget (first upcoming)
  const nextTrip = upcoming[0]?.trip ?? null;
  // Remaining upcoming trips (skip the one shown in the big card)
  const remainingUpcoming = upcoming.slice(1);

  const hasSomeTrips = unplanned.length + ongoing.length + upcoming.length + completed.length > 0;

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">Welcome back,</p>
            <h1 className="text-xl font-bold">
              {profile?.display_name || "Traveler"}
            </h1>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="flex-1 pb-8">
        <div className="px-4 mb-4">
          <EnableNotifications />
        </div>

        {/* Top flip countdown — next upcoming trip */}
        {nextTrip && (
          <FlipCountdown
            trip={nextTrip}
            memberCount={memberCountMap[nextTrip.id] || 0}
            isAdmin={adminTripIds.has(nextTrip.id)}
          />
        )}

        <div className="px-4">
          {/* ── New Trip button row ──────────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Your Trips
            </h2>
            <Link
              href="/trip/new"
              className="rounded-full bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 transition-colors"
            >
              + New Trip
            </Link>
          </div>

          {!hasSomeTrips ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <span className="text-5xl mb-4">🧳</span>
              <p className="text-gray-400 text-sm mb-6">
                No trips yet. Start planning your first adventure!
              </p>
              <Link
                href="/trip/new"
                className="rounded-full bg-teal-500 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-600 transition-colors"
              >
                Create Your First Trip
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 1. Happening Now */}
              {ongoing.length > 0 && (
                <section>
                  <SectionHeader label="Happening Now" dot="green" />
                  <div className="space-y-3">
                    {ongoing.map((trip) => (
                      <SwipeTripCard
                        key={trip.id}
                        trip={trip}
                        status={getTripStatus(trip)}
                        memberCount={memberCountMap[trip.id] || 0}
                        isAdmin={adminTripIds.has(trip.id)}
                        isOngoing
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* 2. Upcoming (skip first — already in big card) */}
              {remainingUpcoming.length > 0 && (
                <section>
                  <SectionHeader label="Upcoming" />
                  <div className="space-y-3">
                    {remainingUpcoming.map(({ trip }) => (
                      <SwipeTripCard
                        key={trip.id}
                        trip={trip}
                        status={getTripStatus(trip)}
                        memberCount={memberCountMap[trip.id] || 0}
                        isAdmin={adminTripIds.has(trip.id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* 3. Past Trips */}
              {completed.length > 0 && (
                <section>
                  <SectionHeader label="Past Trips" />
                  <div className="space-y-3">
                    {completed.map((trip) => (
                      <SwipeTripCard
                        key={trip.id}
                        trip={trip}
                        status={getTripStatus(trip)}
                        memberCount={memberCountMap[trip.id] || 0}
                        isAdmin={adminTripIds.has(trip.id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* 4. Unplanned / Draft */}
              {unplanned.length > 0 && (
                <section>
                  <SectionHeader label="Unplanned" />
                  <div className="space-y-3">
                    {unplanned.map((trip) => (
                      <SwipeTripCard
                        key={trip.id}
                        trip={trip}
                        status={null}
                        memberCount={memberCountMap[trip.id] || 0}
                        isAdmin={adminTripIds.has(trip.id)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
