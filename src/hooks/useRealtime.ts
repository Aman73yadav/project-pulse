import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type RealtimeTable =
  | "tasks"
  | "task_activity"
  | "notifications"
  | "task_comments"
  | "task_attachments";

/**
 * Subscribes to Postgres change events over the Realtime WebSocket and
 * refreshes the affected queries. The socket carries the signed-in user's
 * access token, so row-level security decides which replicated rows each
 * role receives — a developer never gets another developer's task events.
 *
 * Missed-event catch-up: whenever the socket (re)subscribes, or the tab comes
 * back online / becomes visible, the queries are re-read from the database
 * rather than replayed from memory.
 */
export function useRealtimeRefresh(
  tables: RealtimeTable[],
  queryKeys: string[],
  channelName: string,
) {
  const queryClient = useQueryClient();
  const tableKey = tables.join(",");
  const keyList = queryKeys.join(",");

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      for (const key of keyList.split(",")) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    };

    const channel = supabase.channel(channelName);
    for (const table of tableKey.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const token = data.session?.access_token;
      if (token) supabase.realtime.setAuth(token);
      channel.subscribe((status) => {
        // Fires on first connect and on every automatic reconnect.
        if (status === "SUBSCRIBED") refresh();
      });
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [channelName, tableKey, keyList, queryClient]);
}
