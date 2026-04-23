"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Attachment, ExpenseCategory } from "@/lib/types";
import DatePicker from "@/components/DatePicker";

interface AddExpenseButtonProps {
  tripId: string;
  defaultCategory?: ExpenseCategory;
}

export default function AddExpenseButton({ tripId, defaultCategory = "shared" }: AddExpenseButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [itemName, setItemName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>(defaultCategory);
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selected]);
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !amount) return;

    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const attachments: Attachment[] = [];

    for (const file of files) {
      const fileExt = file.name.split(".").pop();
      const filePath = `${tripId}/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(filePath, file);

      if (!uploadError) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("receipts").getPublicUrl(filePath);
        attachments.push({ url: publicUrl, name: file.name });
      }
    }

    await supabase.from("expenses").insert({
      trip_id: tripId,
      paid_by: user.id,
      item_name: itemName.trim(),
      amount: parseFloat(amount),
      category,
      receipt_url: attachments[0]?.url ?? null,
      attachments,
      created_at: new Date(`${expenseDate}T${new Date().toTimeString().slice(0, 8)}`).toISOString(),
    });

    setItemName("");
    setAmount("");
    setCategory(defaultCategory);
    setExpenseDate(new Date().toISOString().split("T")[0]);
    setFiles([]);
    setIsOpen(false);
    setLoading(false);
    router.refresh();
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full rounded-2xl bg-coral-500 py-3 text-sm font-semibold text-white hover:bg-coral-600 transition-colors shadow-card"
      >
        + Add Expense
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setIsOpen(false)}
          />

          <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white px-5 pb-24 pt-4 animate-slideUp">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-300" />

            <h3 className="text-lg font-semibold mb-4">Add Expense</h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  What was it for?
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Boat tickets"
                  required
                  autoFocus
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Type
                </label>
                <div className="flex rounded-2xl border border-gray-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCategory("personal")}
                    className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                      category === "personal"
                        ? "bg-teal-500 text-white"
                        : "text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    Personal
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategory("shared")}
                    className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                      category === "shared"
                        ? "bg-teal-500 text-white"
                        : "text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    Shared
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Amount (MYR)
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0.01"
                    required
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Date
                  </label>
                  <DatePicker
                    value={expenseDate}
                    onChange={setExpenseDate}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Attachments (optional)
                </label>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={addFiles}
                  className="hidden"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={addFiles}
                  className="hidden"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    File
                  </button>
                </div>
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {files.map((file, i) => (
                      <li key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-xs">
                        <span className="truncate mr-2">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="text-gray-400 hover:text-red-500 shrink-0"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !itemName.trim() || !amount}
                  className="flex-1 rounded-2xl bg-teal-500 py-3 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
