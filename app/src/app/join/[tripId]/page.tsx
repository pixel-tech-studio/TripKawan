import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import JoinButton from "./JoinButton";

export default async function JoinTripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Not logged in — redirect to login, then back here
    redirect(`/login?next=/join/${tripId}`);
  }

  // Check if trip exists
  const { data: trip } = await supabase
    .from("trips")
    .select("id, name, start_date, end_date")
    .eq("id", tripId)
    .single();

  if (!trip) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <span className="text-5xl mb-4">😕</span>
        <h1 className="text-xl font-bold mb-2">Trip not found</h1>
        <p className="text-sm text-gray-400">
          This invite link may be invalid or expired.
        </p>
      </div>
    );
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from("trip_members")
    .select("id, status")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .single();

  if (existing?.status === "approved") {
    redirect(`/trip/${tripId}`);
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-MY", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const dateRange =
    trip.start_date && trip.end_date
      ? `${formatDate(trip.start_date)} – ${formatDate(trip.end_date)}`
      : "";

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <span className="text-5xl mb-4 block">🏝️</span>
        <h1 className="text-2xl font-bold text-teal-600 mb-1">
          {trip.name}
        </h1>
        {dateRange && (
          <p className="text-sm text-gray-400 mb-6">{dateRange}</p>
        )}

        <p className="text-sm text-gray-500 mb-6">
          You&apos;ve been invited to join this trip!
        </p>

        {existing?.status === "pending" ? (
          <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-700">
            Your request is pending approval from the trip admin.
          </div>
        ) : (
          <JoinButton tripId={tripId} />
        )}
      </div>
    </div>
  );
}
