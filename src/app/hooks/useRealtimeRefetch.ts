import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Subscribes to Supabase Realtime changes on the given tables.
 * Calls `refetch` whenever any INSERT / UPDATE / DELETE lands on those tables.
 *
 * Usage:
 *   useRealtimeRefetch(fetchData, ["clients", "project_payments"]);
 */
export function useRealtimeRefetch(
  refetch: () => void,
  tables: string[],
  channelSuffix?: string
) {
  useEffect(() => {
    if (!tables.length) return;

    const channelName = `realtime-${channelSuffix ?? tables.join("-")}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(channelName);

    tables.forEach((table) => {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        () => refetch()
      );
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
