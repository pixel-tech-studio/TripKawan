"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface DeleteExpenseButtonProps {
  expenseId: string;
}

export default function DeleteExpenseButton({
  expenseId,
}: DeleteExpenseButtonProps) {
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm("Delete this expense?")) return;

    const supabase = createClient();
    await supabase.from("expenses").delete().eq("id", expenseId);
    router.refresh();
  };

  return (
    <button
      onClick={handleDelete}
      className="text-xs text-gray-300 hover:text-red-400 transition-colors"
      title="Delete expense"
    >
      ✕
    </button>
  );
}
