import Link from "next/link";
import type { Trip } from "@/lib/types";

interface TripHeaderProps {
  trip: Trip;
}

export default function TripHeader({ trip }: TripHeaderProps) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-MY", {
      month: "short",
      day: "numeric",
    });
  };

  const dateRange =
    trip.start_date && trip.end_date
      ? `${formatDate(trip.start_date)} – ${formatDate(trip.end_date)}`
      : "";

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 pt-3 pb-3">
      <Link
        href="/"
        aria-label="Back to trips"
        className="inline-flex items-center gap-1 -ml-2 mb-1.5 px-2 py-1.5 rounded-lg text-teal-600 hover:bg-teal-50 hover:text-teal-700 text-base font-medium transition-colors"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Trips
      </Link>

      <h1 className="text-xl font-bold text-gray-900 leading-tight truncate">
        {trip.name}
      </h1>

      {(trip.destination || dateRange) && (
        <div className="flex items-center gap-1.5 mt-0.5 text-sm text-gray-500">
          {trip.destination && (
            <span className="truncate">{trip.destination}</span>
          )}
          {trip.destination && dateRange && (
            <span className="text-gray-300">·</span>
          )}
          {dateRange && (
            <span className="shrink-0">{dateRange}</span>
          )}
        </div>
      )}
    </header>
  );
}
