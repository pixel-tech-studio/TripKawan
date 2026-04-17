"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TABLES = ["trips", "trip_members", "itinerary_items", "expenses"];

export default function RealtimeRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("realtime-refresh")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLES[0] },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLES[1] },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLES[2] },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLES[3] },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
