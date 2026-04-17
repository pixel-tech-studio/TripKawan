"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TABLES = ["trips", "trip_members", "itinerary_items", "expenses"];

export default function RealtimeRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      channel = supabase.channel("realtime-refresh");
      for (const table of TABLES) {
        channel = channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => router.refresh()
        );
      }
      channel.subscribe();
    };

    setup();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") setup();
      if (event === "SIGNED_OUT" && channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    });

    return () => {
      subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
