"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

interface Member {
  id: string;
  user_id: string;
  role: string;
  profiles: Profile;
}

interface SwipeMemberCardProps {
  member: Member;
  tripId: string;
  isCurrentUser: boolean;
  isViewerAdmin: boolean;
  adminCount: number;
}

const SWIPE_REVEAL = 80;
const SWIPE_THRESHOLD = 40;

export default function SwipeMemberCard({
  member,
  tripId,
  isCurrentUser,
  isViewerAdmin,
  adminCount,
}: SwipeMemberCardProps) {
  const router = useRouter();
  const profile = member.profiles;
  const isAdminMember = member.role === "admin";
  const isLastAdmin = isAdminMember && adminCount <= 1;

  const [translateX, setTranslateX] = useState(0);
  const [side, setSide] = useState<"left" | "right" | null>(null); // which panel is revealed
  const [snapping, setSnapping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [removed, setRemoved] = useState(false);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const didSwipe = useRef(false);
  const axisLocked = useRef<"h" | "v" | null>(null);

  // Admins can swipe non-self members. Current user can't swipe themselves.
  const canSwipe = isViewerAdmin && !isCurrentUser;
  // Can promote: member is not yet admin
  const canPromote = canSwipe && !isAdminMember;
  // Can demote: member is admin, but not the last one
  const canDemote = canSwipe && isAdminMember && !isLastAdmin;
  // Can remove: any non-self member
  const canRemove = canSwipe;

  const snapTo = (x: number, revealedSide: "left" | "right" | null) => {
    setSnapping(true);
    setTranslateX(x);
    setSide(revealedSide);
    setTimeout(() => setSnapping(false), 200);
  };

  const close = () => snapTo(0, null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!canSwipe) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    didSwipe.current = false;
    axisLocked.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!canSwipe) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    if (!axisLocked.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      axisLocked.current = Math.abs(dy) > Math.abs(dx) ? "v" : "h";
    }
    if (axisLocked.current !== "h") return;

    didSwipe.current = true;

    if (side === "right") {
      // Currently showing remove panel (right) — allow swipe back right
      setTranslateX(Math.min(0, -SWIPE_REVEAL + dx));
    } else if (side === "left") {
      // Currently showing promote/demote panel (left) — allow swipe back left
      setTranslateX(Math.max(0, SWIPE_REVEAL + dx));
    } else {
      // Nothing revealed
      if (dx < 0 && canRemove) {
        setTranslateX(Math.max(-SWIPE_REVEAL, dx));
      } else if (dx > 0 && (canPromote || canDemote)) {
        setTranslateX(Math.min(SWIPE_REVEAL, dx));
      }
    }
  };

  const handleTouchEnd = () => {
    if (!didSwipe.current) return;

    if (side === "right") {
      translateX > -SWIPE_REVEAL + SWIPE_THRESHOLD ? snapTo(0, null) : snapTo(-SWIPE_REVEAL, "right");
    } else if (side === "left") {
      translateX < SWIPE_REVEAL - SWIPE_THRESHOLD ? snapTo(0, null) : snapTo(SWIPE_REVEAL, "left");
    } else {
      if (translateX < -SWIPE_THRESHOLD && canRemove) {
        snapTo(-SWIPE_REVEAL, "right");
      } else if (translateX > SWIPE_THRESHOLD && (canPromote || canDemote)) {
        snapTo(SWIPE_REVEAL, "left");
      } else {
        snapTo(0, null);
      }
    }
  };

  const handleRemove = async () => {
    if (!confirm(`Remove ${profile?.display_name || "this member"} from the trip?`)) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from("trip_members").delete().eq("id", member.id).eq("trip_id", tripId);
    setRemoved(true);
    router.refresh();
  };

  const handlePromote = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase
      .from("trip_members")
      .update({ role: "admin" })
      .eq("id", member.id)
      .eq("trip_id", tripId);
    close();
    router.refresh();
  };

  const handleDemote = async () => {
    if (!confirm(`Demote ${profile?.display_name || "this member"} to regular member?`)) return;
    setLoading(true);
    const supabase = createClient();
    await supabase
      .from("trip_members")
      .update({ role: "member" })
      .eq("id", member.id)
      .eq("trip_id", tripId);
    close();
    router.refresh();
  };

  if (removed) return null;

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Left panel — Promote / Demote */}
      {(canPromote || canDemote) && (
        <div
          className={`absolute inset-y-0 left-0 w-20 flex flex-col items-center justify-center gap-1 ${
            canDemote ? "bg-amber-400" : "bg-teal-500"
          }`}
        >
          <button
            onClick={canDemote ? handleDemote : handlePromote}
            disabled={loading}
            className="flex flex-col items-center gap-1 text-white px-2"
          >
            {canDemote ? (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="17 13 12 18 7 13" />
                  <line x1="12" y1="18" x2="12" y2="6" />
                </svg>
                <span className="text-[11px] font-semibold">Demote</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="17 11 12 6 7 11" />
                  <line x1="12" y1="6" x2="12" y2="18" />
                </svg>
                <span className="text-[11px] font-semibold">Promote</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Right panel — Remove */}
      {canRemove && (
        <div className="absolute inset-y-0 right-0 w-20 bg-red-500 flex flex-col items-center justify-center gap-1">
          <button
            onClick={handleRemove}
            disabled={loading}
            className="flex flex-col items-center gap-1 text-white px-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
            <span className="text-[11px] font-semibold">Remove</span>
          </button>
        </div>
      )}

      {/* Card */}
      <div
        style={{ transform: `translateX(${translateX}px)` }}
        className={`flex items-center gap-3 rounded-2xl bg-white p-3 shadow-card relative z-10 ${
          snapping ? "transition-transform duration-200" : ""
        }`}
        onClick={() => {
          if (side) close();
        }}
      >
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt=""
            className="h-10 w-10 rounded-full shrink-0"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold text-sm shrink-0 ${
            isAdminMember ? "bg-coral-100 text-coral-600" : "bg-teal-100 text-teal-600"
          }`}>
            {profile?.display_name?.charAt(0) || "?"}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">
              {profile?.display_name || "Unknown"}
            </p>
            {isCurrentUser && (
              <span className="text-[10px] text-gray-400">(you)</span>
            )}
          </div>
          {profile?.email && (
            <p className="text-xs text-gray-400 truncate">{profile.email}</p>
          )}
        </div>

        {isAdminMember && (
          <span className="shrink-0 text-xs bg-coral-50 text-coral-600 px-2 py-0.5 rounded-full font-medium">
            Admin
          </span>
        )}

        {canSwipe && !isAdminMember && !side && (
          <svg className="w-4 h-4 text-gray-200 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
        )}
      </div>
    </div>
  );
}
