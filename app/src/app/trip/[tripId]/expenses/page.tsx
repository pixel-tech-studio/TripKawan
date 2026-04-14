import { createClient } from "@/lib/supabase/server";
import type { ExpenseWithProfile } from "@/lib/types";
import AddExpenseButton from "./AddExpenseButton";
import DeleteExpenseButton from "./DeleteExpenseButton";

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

  const { data: membership } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user?.id ?? "")
    .eq("status", "approved")
    .single();

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
          {expenses.map((expense) => {
            const canDelete = isAdmin || expense.paid_by === user?.id;

            return (
              <li
                key={expense.id}
                className="rounded-2xl bg-white p-4 shadow-card"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    {expense.profiles?.avatar_url ? (
                      <img
                        src={expense.profiles.avatar_url}
                        alt=""
                        className="h-8 w-8 rounded-full mt-0.5 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-teal-600 font-semibold text-xs mt-0.5 shrink-0">
                        {expense.profiles?.display_name?.charAt(0) || "?"}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {expense.item_name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {expense.profiles?.display_name} &middot;{" "}
                        {formatTime(expense.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 ml-3">
                    <span className="text-sm font-semibold text-expense whitespace-nowrap">
                      {formatAmount(Number(expense.amount))}
                    </span>
                    {canDelete && (
                      <DeleteExpenseButton expenseId={expense.id} />
                    )}
                  </div>
                </div>
                {expense.receipt_url && (
                  <a
                    href={expense.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs text-teal-500 hover:text-teal-600 font-medium"
                  >
                    View receipt →
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
