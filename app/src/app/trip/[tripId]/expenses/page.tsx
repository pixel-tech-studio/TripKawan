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
    .order("created_at", { ascending: true })
    .returns<ExpenseWithProfile[]>();

  // Calculate total
  const total =
    expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat("en-MY", {
      style: "currency",
      currency: "MYR",
    }).format(amount);

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-MY", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="px-4 py-4">
      {/* Total Group Spend banner */}
      <div className="rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 p-5 text-white mb-6 shadow-card">
        <p className="text-xs font-medium opacity-80 uppercase tracking-wide">
          Total Group Spend
        </p>
        <p className="text-3xl font-bold mt-1">{formatAmount(total)}</p>
        <p className="text-xs opacity-70 mt-1">
          {expenses?.length || 0} expense{expenses?.length !== 1 ? "s" : ""}{" "}
          logged
        </p>
      </div>

      <AddExpenseButton tripId={tripId} />

      {/* Expense feed */}
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
              formatAmount={formatAmount}
              formatTime={formatTime}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
