import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  configured = true;
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export interface NotifyPayload {
  title: string;
  body: string;
  url?: string;
}

// Send a push to every approved member of a trip *except* the originator.
// Uses the Supabase service role to read every recipient's subscriptions —
// the per-user RLS policy on push_subscriptions only exposes a row to its
// owner, so a normal client couldn't fan out.
//
// Returns counts so callers can log without caring about the details.
// Cleans up subscriptions that the push service reports as gone (404/410).
export async function notifyTripMembers(
  tripId: string,
  originatorUserId: string,
  payload: NotifyPayload
): Promise<{ sent: number; cleaned: number }> {
  configure();
  const admin = adminClient();

  const { data: members } = await admin
    .from("trip_members")
    .select("user_id")
    .eq("trip_id", tripId)
    .eq("status", "approved")
    .neq("user_id", originatorUserId);

  const memberIds = (members ?? []).map((m) => m.user_id);
  if (memberIds.length === 0) return { sent: 0, cleaned: 0 };

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", memberIds);

  if (!subs || subs.length === 0) return { sent: 0, cleaned: 0 };

  const body = JSON.stringify(payload);
  const goneIds: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          goneIds.push(sub.id);
        } else {
          console.error("[push] send failed", sub.endpoint, status, err);
        }
      }
    })
  );

  if (goneIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", goneIds);
  }

  return { sent, cleaned: goneIds.length };
}
