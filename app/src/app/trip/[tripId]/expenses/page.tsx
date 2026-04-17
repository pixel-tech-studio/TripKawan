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
    <div className="px-4 py-4 space-y-8">
      {/* ── Shared Expenses ──────────────────────────────────────────── */}
      <section>
        <div className="rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 p-5 text-white mb-4 shadow-card">
          <p className="text-xs font-medium opacity-80 uppercase tracking-wide">
            Shared Expenses
          </p>
          <p className="text-3xl font-bold mt-1">{formatAmount(sharedTotal)}</p>
          <p className="text-xs opacity-70 mt-1">
            {shared.length} expense{shared.length !== 1 ? "s" : ""} logged
          </p>
        </div>

        <AddExpenseButton tripId={tripId} defaultCategory="shared" />

        {shared.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="text-4xl mb-3">🧾</span>
            <p className="text-gray-400 text-sm">
              No shared expenses yet.
            </p>
          </div>
        ) : (
          <ul className="space-y-3 mt-4">
            {shared.map((expense) => (
              <SwipeExpenseCard
                key={expense.id}
                expense={expense}
                canDelete={isAdmin || expense.paid_by === user?.id}
                tripId={tripId}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ── Your Expenses ────────────────────────────────────────────── */}
      <section>
        <div className="rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 p-5 text-white mb-4 shadow-card">
          <p className="text-xs font-medium opacity-80 uppercase tracking-wide">
            Your Expenses
          </p>
          <p className="text-3xl font-bold mt-1">{formatAmount(personalTotal)}</p>
          <p className="text-xs opacity-70 mt-1">
            {personal.length} expense{personal.length !== 1 ? "s" : ""} &middot; Only visible to you
          </p>
        </div>

        <AddExpenseButton tripId={tripId} defaultCategory="personal" />

        {personal.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="text-4xl mb-3">👤</span>
            <p className="text-gray-400 text-sm">
              No personal expenses yet.
              <br />
              Track your own spending here.
            </p>
          </div>
        ) : (
          <ul className="space-y-3 mt-4">
            {personal.map((expense) => (
              <SwipeExpenseCard
                key={expense.id}
                expense={expense}
                canDelete={true}
                tripId={tripId}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
