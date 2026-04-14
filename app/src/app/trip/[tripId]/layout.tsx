import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import TripHeader from "@/components/TripHeader";
import type { Trip } from "@/lib/types";

async function TripHeaderFetcher({ tripId }: { tripId: string }) {
  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .single<Trip>();

  if (!trip) notFound();
  return <TripHeader trip={trip} />;
}

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;

  return (
    <div className="flex flex-col min-h-full">
      <Suspense
        fallback={
          <div className="sticky top-0 z-40 h-[57px] border-b border-gray-100 bg-white/95" />
        }
      >
        <TripHeaderFetcher tripId={tripId} />
      </Suspense>
      <main className="flex-1 pb-nav">{children}</main>
      <BottomNav tripId={tripId} />
    </div>
  );
}
