import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import type { Trip } from "@/lib/types";
import EditTripForm from "./EditTripForm";

export default async function EditTripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .single<Trip>();

  if (!trip) notFound();
  if (trip.admin_user_id !== user.id) redirect(`/trip/${tripId}/itinerary`);

  return <EditTripForm trip={trip} />;
}
