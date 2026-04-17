import { createClient } from "@/lib/supabase/server";
import type { ExpenseWithProfile } from "@/lib/types";
import AddExpenseButton from "./AddExpenseButton";
import SwipeExpenseCard from "./SwipeExpenseCard";

export default async function ExpensesPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = user
    ? await supabase
        .from("trip_members")
        .select("role")
        .eq("trip_id", tripId)
        .eq("user_id", user.id)
        .eq("status", "approved")
        .single()
    : { data: null };

  const isAdmin = membership?.role === "admin";

  const { data: expenses } = await supabase
    .from("expenses")
    .select("*, profiles(display_name, avatar_url)")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false })
    .returns<ExpenseWithProfile[]>();

  const personal = expenses?.filter((e) => e.category === "personal") || [];
  const shared = expenses?.filter((e) => e.category !== "personal") || [];

  const personalTotal = personal.reduce((sum, e) => sum + Number(e.amount), 0);
  const sharedTotal = shared.reduce((sum, e) => sum + Number(e.amount), 0);

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat("en-MY", {
      style: "currency",
      currency: "MYR",
    }).format(amount);

  return (
    <div className="py-4">
      {/* Sticky header: totals + add button */}
      <div className="sticky top-[57px] z-30 bg-sand-50 px-4 pb-3">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 p-4 text-white shadow-card">
            <p className="text-[10px] font-medium opacity-80 uppercase tracking-wide">
              Shared
            </p>
            <p className="text-xl font-bold mt-1">{formatAmount(sharedTotal)}</p>
            <p className="text-[10px] opacity-70 mt-0.5">
              {shared.length} expense{shared.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 p-4 text-white shadow-card">
            <p className="text-[10px] font-medium opacity-80 uppercase tracking-wide">
              Yours
            </p>
            <p className="text-xl font-bold mt-1">{formatAmount(personalTotal)}</p>
            <p className="text-[10px] opacity-70 mt-0.5">
              {personal.length} expense{personal.length !== 1 ? "s" : ""} &middot; Private
            </p>
          </div>
        </div>

        <AddExpenseButton tripId={tripId} />
      </div>

      {/* Combined list sorted by latest */}
      <div className="px-4">
      {!expenses || expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="text-5xl mb-4">🧾</span>
          <p className="text-gray-400 text-sm">
            No expenses logged yet.
            <br />
            Tap the button above to add one!
          </p>
        </div>
      ) : (
        <ul className="space-y-3 mt-4">
          {expenses.map((expense) => (
            <SwipeExpenseCard
              key={expense.id}
              expense={expense}
              canDelete={isAdmin || expense.paid_by === user?.id}
              tripId={tripId}
            />
          ))}
        </ul>
      )}
      </div>
    </div>
  );
}
