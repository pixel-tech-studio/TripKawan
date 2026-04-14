"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { TripPreferences } from "@/lib/types";

const STEPS = [
  {
    key: "travel_style",
    question: "What's the vibe of this trip?",
    options: [
      { value: "adventure", label: "Adventure", emoji: "🧗" },
      { value: "relaxed", label: "Chill & Relax", emoji: "🏖️" },
      { value: "cultural", label: "Culture & History", emoji: "🏛️" },
      { value: "foodie", label: "Food Hunting", emoji: "🍜" },
    ],
  },
  {
    key: "accommodation",
    question: "Where will you be staying?",
    options: [
      { value: "budget", label: "Budget / Hostel", emoji: "🛏️" },
      { value: "mid_range", label: "Mid-range Hotel", emoji: "🏨" },
      { value: "luxury", label: "Luxury Resort", emoji: "🌟" },
      { value: "airbnb", label: "Airbnb / Homestay", emoji: "🏡" },
    ],
  },
  {
    key: "dining",
    question: "How does the group like to eat?",
    options: [
      { value: "street_food", label: "Street Food Only", emoji: "🥢" },
      { value: "restaurants", label: "Sit-down Restaurants", emoji: "🍽️" },
      { value: "cafes", label: "Cafes & Brunch Spots", emoji: "☕" },
      { value: "mix", label: "Mix of Everything", emoji: "🌈" },
    ],
  },
  {
    key: "activity_interests",
    question: "What are you all into?",
    multi: true,
    options: [
      { value: "nature", label: "Nature & Outdoors", emoji: "🌿" },
      { value: "shopping", label: "Shopping", emoji: "🛍️" },
      { value: "museums", label: "Museums & Art", emoji: "🖼️" },
      { value: "nightlife", label: "Nightlife", emoji: "🌙" },
      { value: "beaches", label: "Beaches & Water", emoji: "🏄" },
      { value: "sports", label: "Sports & Fitness", emoji: "⚽" },
      { value: "photography", label: "Photography Spots", emoji: "📸" },
      { value: "local_markets", label: "Local Markets", emoji: "🏪" },
    ],
  },
  {
    key: "budget",
    question: "What's the group's budget per person?",
    options: [
      { value: "budget", label: "Budget", emoji: "💸" },
      { value: "moderate", label: "Moderate", emoji: "💰" },
      { value: "splurge", label: "Splurge", emoji: "💎" },
    ],
  },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

interface Answers {
  travel_style: string;
  accommodation: string;
  dining: string;
  activity_interests: string[];
  budget: string;
  special_notes: string;
}

const defaultAnswers: Answers = {
  travel_style: "",
  accommodation: "",
  dining: "",
  activity_interests: [],
  budget: "",
  special_notes: "",
};

export default function SetupPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = use(params);
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(defaultAnswers);
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient();

      // Pre-fill if preferences already exist
      const { data: prefs } = await supabase
        .from("trip_preferences")
        .select("*")
        .eq("trip_id", tripId)
        .single<TripPreferences>();

      if (prefs) {
        setAnswers({
          travel_style: prefs.travel_style,
          accommodation: prefs.accommodation,
          dining: prefs.dining,
          activity_interests: prefs.activity_interests,
          budget: prefs.budget,
          special_notes: prefs.special_notes ?? "",
        });
        setNotes(prefs.special_notes ?? "");
      }
    };

    loadData();
  }, [tripId]);

  const currentStep = STEPS[step];
  const isMulti = "multi" in currentStep && currentStep.multi;
  const isLastStep = step === STEPS.length - 1;

  const currentValue = isMulti
    ? answers.activity_interests
    : answers[currentStep.key as Exclude<StepKey, "activity_interests">];

  const isCurrentStepAnswered = isMulti
    ? answers.activity_interests.length > 0
    : Boolean(currentValue);

  const handleSelect = (value: string) => {
    if (isMulti) {
      setAnswers((prev) => ({
        ...prev,
        activity_interests: prev.activity_interests.includes(value)
          ? prev.activity_interests.filter((v) => v !== value)
          : [...prev.activity_interests, value],
      }));
    } else {
      setAnswers((prev) => ({
        ...prev,
        [currentStep.key]: value,
      }));
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    }
  };

  const handleSubmit = async () => {
    setGenerating(true);

    const supabase = createClient();
    const finalAnswers = { ...answers, special_notes: notes };

    // Save preferences (upsert in case of re-run)
    const { error: prefError } = await supabase
      .from("trip_preferences")
      .upsert(
        {
          trip_id: tripId,
          travel_style: finalAnswers.travel_style,
          accommodation: finalAnswers.accommodation,
          dining: finalAnswers.dining,
          activity_interests: finalAnswers.activity_interests,
          budget: finalAnswers.budget,
          special_notes: finalAnswers.special_notes || null,
        },
        { onConflict: "trip_id" }
      );

    if (prefError) {
      alert(`Failed to save preferences: ${prefError.message}`);
      setGenerating(false);
      return;
    }

    // Call AI generation (basePath "/app" must be included for fetch calls)
    const res = await fetch(`/app/api/trips/${tripId}/generate-itinerary`, {
      method: "POST",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(`Generation failed: ${body.error || res.statusText}`);
      setGenerating(false);
      return;
    }

    router.push(`/trip/${tripId}/itinerary`);
  };

  const handleSkip = () => {
    router.push(`/trip/${tripId}/itinerary`);
  };

  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh px-6 text-center">
        <div className="text-5xl mb-6 animate-bounce">🗺️</div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">
          Planning your trip...
        </h2>
        <p className="text-sm text-gray-400">
          Hang tight while we craft your itinerary.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <header className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
            Trip Setup
          </p>
          <button
            onClick={handleSkip}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Skip for now
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                i <= step ? "bg-teal-500" : "bg-gray-100"
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          Step {step + 1} of {STEPS.length}
        </p>
      </header>

      {/* Question */}
      <div className="flex-1 px-4 pt-6 pb-8 flex flex-col">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          {currentStep.question}
        </h2>

        <div
          className={`grid gap-3 ${isMulti ? "grid-cols-2" : "grid-cols-2"}`}
        >
          {currentStep.options.map((opt) => {
            const isSelected = isMulti
              ? answers.activity_interests.includes(opt.value)
              : answers[
                  currentStep.key as Exclude<StepKey, "activity_interests">
                ] === opt.value;

            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-4 text-sm font-medium transition-all duration-150 ${
                  isSelected
                    ? "border-teal-500 bg-teal-50 text-teal-700"
                    : "border-gray-100 bg-white text-gray-600 hover:border-gray-200"
                }`}
              >
                <span className="text-2xl">{opt.emoji}</span>
                <span className="text-center leading-tight">{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Notes field on last step */}
        {isLastStep && (
          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-600 mb-1.5">
              Anything else to note? (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 2 vegetarians in the group, avoid seafood..."
              rows={3}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
            />
          </div>
        )}

        {/* Navigation */}
        <div className="mt-auto pt-6 flex gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              ← Back
            </button>
          )}
          {isLastStep ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isCurrentStepAnswered}
              className="flex-1 rounded-2xl bg-teal-500 py-3 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50 transition-colors"
            >
              Generate Itinerary ✨
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              disabled={!isCurrentStepAnswered}
              className="flex-1 rounded-2xl bg-teal-500 py-3 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50 transition-colors"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
