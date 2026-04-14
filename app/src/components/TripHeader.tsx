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
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 pt-3 pb-3">
      <div className="flex items-center gap-3">
        {/* Back button */}
        <Link
          href="/"
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          aria-label="Back to trips"
        >
          <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>

        {/* Trip info */}
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold text-gray-900 leading-tight truncate">
            {trip.name}
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            {trip.destination && (
              <>
                <span className="text-xs text-gray-400 truncate">{trip.destination}</span>
                {dateRange && <span className="text-gray-200 text-xs">·</span>}
              </>
            )}
            {dateRange && (
              <span className="text-xs text-gray-400 shrink-0">{dateRange}</span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
