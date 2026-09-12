import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Live "who is online right now" count using Realtime presence over the
 * WebSocket connection. No polling. Multiple hook subscribers share one
 * channel so the same user is never double-tracked.
 */

type Listener = (online: number) => void;

let channel: ReturnType<typeof supabase.channel> | null = null;
let channelKey = "";
const listeners = new Set<Listener>();

function notify() {
  if (!channel) return;
  const online = Object.keys(channel.presenceState()).length;
  listeners.forEach((listener) => listener(online));
}

function ensureChannel(userId: string, name: string | undefined) {
  const key = `${userId}`;
  if (channel && channelKey === key) return;

  if (channel) void supabase.removeChannel(channel);
  channelKey = key;
  channel = supabase.channel("agency-presence", {
    config: { presence: { key: userId } },
  });

  channel
    .on("presence", { event: "sync" }, notify)
    .on("presence", { event: "join" }, notify)
    .on("presence", { event: "leave" }, notify)
    .subscribe((status) => {
      if (status === "SUBSCRIBED" && channel) {
        void channel.track({ name: name ?? "Team member", at: new Date().toISOString() });
      }
    });
}

export function usePresence(userId: string | undefined, name: string | undefined) {
  const [online, setOnline] = useState(0);

  useEffect(() => {
    if (!userId) return;
    ensureChannel(userId, name);
    listeners.add(setOnline);
    notify();
    return () => {
      listeners.delete(setOnline);
      if (listeners.size === 0 && channel) {
        void supabase.removeChannel(channel);
        channel = null;
        channelKey = "";
      }
    };
  }, [userId, name]);

  return online;
}
