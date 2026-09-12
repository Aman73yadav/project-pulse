import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to Postgres change events over the Realtime WebSocket and
 * refreshes the affected queries. Row-level security is applied to the
 * replicated rows, so a subscriber never receives rows outside their role.
 */
export function useRealtimeRefresh(
  tables: Array<"tasks" | "task_activity" | "notifications">,
  queryKeys: string[],
  channelName: string,
) {
  const queryClient = useQueryClient();
  const tableKey = tables.join(",");
  const keyList = queryKeys.join(",");

  useEffect(() => {
    const channel = supabase.channel(channelName);
    for (const table of tableKey.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        for (const key of keyList.split(",")) {
          void queryClient.invalidateQueries({ queryKey: [key] });
        }
      });
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelName, tableKey, keyList, queryClient]);
}
