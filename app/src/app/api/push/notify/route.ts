import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyTripMembers } from "@/lib/push";

// POST /api/push/notify — fan out a notification to other members of a
// trip. The caller must be authenticated and an approved member of the
// trip. The notification skips the caller's own subscriptions.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const tripId = body?.tripId;
  const title = body?.title;
  const message = body?.body;
  const url = body?.url;
  if (!tripId || !title || !message) {
    return NextResponse.json(
      { error: "Missing tripId, title, or body" },
      { status: 400 }
    );
  }

  // Confirm the caller is actually in this trip — without this check
  // anyone could spam notifications to any trip's members.
  const { data: membership } = await supabase
    .from("trip_members")
    .select("trip_id")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .eq("status", "approved")
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Not a trip member" }, { status: 403 });
  }

  const result = await notifyTripMembers(tripId, user.id, {
    title,
    body: message,
    url,
  });

  return NextResponse.json({ ok: true, ...result });
}
