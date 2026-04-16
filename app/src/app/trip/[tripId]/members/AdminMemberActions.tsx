"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface AdminMemberActionsProps {
  memberId: string;
  memberUserId: string;
  memberName: string;
  tripId: string;
}

export default function AdminMemberActions({
  memberId,
  memberUserId,
  memberName,
  tripId,
}: AdminMemberActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePromote = async () => {
    if (!confirm(`Make ${memberName} an admin of this trip?`)) return;
    setLoading(true);
    const supabase = createClient();
    await supabase
      .from("trip_members")
      .update({ role: "admin" })
      .eq("trip_id", tripId)
      .eq("user_id", memberUserId);
    setOpen(false);
    router.refresh();
  };

  const handleRemove = async () => {
    if (!confirm(`Remove ${memberName} from this trip?`)) return;
    setLoading(true);
    const supabase = createClient();
    await supabase
      .from("trip_members")
      .delete()
      .eq("id", memberId)
      .eq("trip_id", tripId);
    setOpen(false);
    router.refresh();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
        aria-label="Member options"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          {/* Menu */}
          <div className="absolute right-0 top-9 z-20 w-44 rounded-2xl bg-white shadow-lg border border-gray-100 overflow-hidden">
            <button
              onClick={handlePromote}
              disabled={loading}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left text-teal-700 hover:bg-teal-50 transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Make Admin
            </button>
            <div className="h-px bg-gray-100" />
            <button
              onClick={handleRemove}
              disabled={loading}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left text-red-500 hover:bg-red-50 transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              Remove
            </button>
          </div>
        </>
      )}
    </div>
  );
}
