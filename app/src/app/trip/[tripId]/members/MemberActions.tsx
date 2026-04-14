"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface MemberActionsProps {
  memberId: string;
  tripId: string;
  status: string;
}

export default function MemberActions({
  memberId,
  tripId,
  status,
}: MemberActionsProps) {
  const router = useRouter();

  const handleApprove = async () => {
    const supabase = createClient();
    await supabase
      .from("trip_members")
      .update({ status: "approved" })
      .eq("id", memberId)
      .eq("trip_id", tripId);
    router.refresh();
  };

  const handleReject = async () => {
    const supabase = createClient();
    await supabase
      .from("trip_members")
      .delete()
      .eq("id", memberId)
      .eq("trip_id", tripId);
    router.refresh();
  };

  if (status !== "pending") return null;

  return (
    <div className="flex gap-2 ml-auto">
      <button
        onClick={handleApprove}
        className="rounded-full bg-teal-500 px-3 py-1 text-xs font-medium text-white hover:bg-teal-600"
      >
        Approve
      </button>
      <button
        onClick={handleReject}
        className="rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-300"
      >
        Reject
      </button>
    </div>
  );
}
