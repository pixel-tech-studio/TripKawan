"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface RemoveMemberButtonProps {
  memberId: string;
  memberName: string;
  tripId: string;
}

export default function RemoveMemberButton({
  memberId,
  memberName,
  tripId,
}: RemoveMemberButtonProps) {
  const router = useRouter();

  const handleRemove = async () => {
    if (!confirm(`Remove ${memberName} from this trip?`)) return;

    const supabase = createClient();
    await supabase
      .from("trip_members")
      .delete()
      .eq("id", memberId)
      .eq("trip_id", tripId);
    router.refresh();
  };

  return (
    <button
      onClick={handleRemove}
      className="text-xs text-gray-300 hover:text-red-400 transition-colors"
      title="Remove member"
    >
      ✕
    </button>
  );
}
