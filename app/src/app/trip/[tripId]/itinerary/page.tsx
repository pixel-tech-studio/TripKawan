import { createClient } from "@/lib/supabase/server";
import type { Trip, ItineraryItemWithProfile } from "@/lib/types";
import ItineraryBoard from "./ItineraryBoard";

export default async function ItineraryPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .single<Trip>();

  const { data: membership } = user
    ? await supabase
        .from("trip_members")
        .select("role")
        .eq("trip_id", tripId)
        .eq("user_id", user.id)
        .eq("status", "approved")
        .single()
    : { data: null };

  const isAdmin = membership?.role === "admin";

  const { data: allItems } = await supabase
    .from("itinerary_items")
    .select("*, profiles(display_name)")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true })
    .returns<ItineraryItemWithProfile[]>();

  const items = allItems?.filter((i) => i.day_date !== null) || [];
  const kivItems = allItems?.filter((i) => i.day_date === null) || [];

  // Generate day list between start and end dates
  const days: string[] = [];
  if (trip?.start_date && trip?.end_date) {
    const start = new Date(trip.start_date + "T00:00:00");
    const end = new Date(trip.end_date + "T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      days.push(`${y}-${m}-${day}`);
    }
  }

  const itemsByDay = days.reduce(
    (acc, day) => {
      acc[day] = items.filter((i) => i.day_date === day);
      return acc;
    },
    {} as Record<string, ItineraryItemWithProfile[]>
  );

  // Key ensures ItineraryBoard remounts when items are added/deleted
  const itemsKey = allItems?.map((i) => i.id).sort().join(",") ?? "";

  return (
    <div className="px-4 py-4">
      {days.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="text-5xl mb-4">🧳</span>
          <p className="text-gray-400 text-sm">
            No dates set for this trip yet.
            <br />
            Ask the trip admin to add start & end dates.
          </p>
        </div>
      ) : (
        <ItineraryBoard
          key={itemsKey}
          days={days}
          initialItemsByDay={itemsByDay}
          initialKivItems={kivItems}
          isAdmin={isAdmin}
          tripId={tripId}
        />
      )}
    </div>
  );
}
