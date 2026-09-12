import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Live "who is online right now" count using Realtime presence over the
 * WebSocket connection. No polling.
 */
export function usePresence(userId: string | undefined, name: string | undefined) {
  const [online, setOnline] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel("agency-presence", {
      config: { presence: { key: userId } },
    });

    const sync = () => {
      const state = channel.presenceState();
      setOnline(Object.keys(state).length);
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ name: name ?? "Team member", at: new Date().toISOString() });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, name]);

  return online;
}
