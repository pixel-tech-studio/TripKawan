import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import ShareLink from "./ShareLink";
import MemberActions from "./MemberActions";
import SwipeMemberCard from "./SwipeMemberCard";

export default async function MembersPage({
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
    .select("admin_user_id")
    .eq("id", tripId)
    .single();

  const { data: members } = await supabase
    .from("trip_members")
    .select("id, user_id, status, joined_at, profiles(id, display_name, avatar_url, email)")
    .eq("trip_id", tripId)
    .order("joined_at", { ascending: true });

  const approved = members?.filter((m) => m.status === "approved") || [];
  const pending = members?.filter((m) => m.status === "pending") || [];

  const adminUserId = trip?.admin_user_id ?? null;
  const isAdmin = !!user && adminUserId === user.id;
  // single-admin model; there is always exactly one admin (the trip.admin_user_id)
  const adminCount = 1;

  return (
    <div className="px-4 py-4">
      {isAdmin && <ShareLink tripId={tripId} />}

      {/* Pending requests */}
      {isAdmin && pending.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-amber-600 uppercase tracking-wide mb-3">
            Pending Requests ({pending.length})
          </h2>
          <ul className="space-y-3 mb-6">
            {pending.map((member) => {
              const profile = member.profiles as unknown as Profile;
              return (
                <li
                  key={member.id}
                  className="flex items-center gap-3 rounded-2xl bg-amber-50 border border-amber-200 p-3"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="h-10 w-10 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 font-semibold text-sm">
                      {profile?.display_name?.charAt(0) || "?"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">
                      {profile?.display_name || "Unknown"}
                    </p>
                    {profile?.email && (
                      <p className="text-xs text-gray-400 truncate">
                        {profile.email}
                      </p>
                    )}
                  </div>
                  <MemberActions
                    memberId={member.id}
                    tripId={tripId}
                    status={member.status}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Approved members */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Members ({approved.length})
      </h2>

      <ul className="space-y-3">
        {approved.map((member) => {
          const profile = member.profiles as unknown as Profile;
          return (
            <li key={member.id}>
              <SwipeMemberCard
                member={{
                  id: member.id,
                  user_id: member.user_id,
                  profiles: profile,
                }}
                tripId={tripId}
                adminUserId={adminUserId}
                isCurrentUser={member.user_id === user?.id}
                isViewerAdmin={isAdmin}
                adminCount={adminCount}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
