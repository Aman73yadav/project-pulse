import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { listNotifications, markNotificationsRead } from "@/lib/dashboard.functions";
import { timeAgo, type AppNotification } from "@/lib/domain";
import { useRealtimeRefresh } from "@/hooks/useRealtime";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { readableError } from "@/lib/api-error";
import { toast } from "sonner";

export function NotificationBell() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications() as Promise<AppNotification[]>,
  });

  useRealtimeRefresh(["notifications"], ["notifications"], "notifications-bell");

  const markRead = useMutation({
    mutationFn: (input: { ids?: string[]; all?: boolean }) =>
      markNotificationsRead({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (error) => toast.error(readableError(error)),
  });

  const unread = query.data?.filter((n) => !n.read_at) ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-5" />
          {unread.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-medium">Notifications</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={unread.length === 0 || markRead.isPending}
            onClick={() => markRead.mutate({ all: true })}
          >
            <CheckCheck className="size-3.5" /> Mark all read
          </Button>
        </div>
        <ScrollArea className="max-h-80">
          {(query.data?.length ?? 0) === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {query.data?.map((n) => (
                <li key={n.id} className={n.read_at ? "bg-transparent" : "bg-accent/40"}>
                  <button
                    type="button"
                    className="w-full px-3 py-2.5 text-left hover:bg-secondary/70"
                    onClick={() => !n.read_at && markRead.mutate({ ids: [n.id] })}
                  >
                    <p className="text-sm leading-snug">{n.message}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {timeAgo(n.created_at)}
                      {!n.read_at && " · tap to mark read"}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
