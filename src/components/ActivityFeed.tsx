import { useQuery } from "@tanstack/react-query";
import { Radio } from "lucide-react";
import { listActivity } from "@/lib/dashboard.functions";
import { describeActivity, timeAgo, type ActivityEntry } from "@/lib/domain";
import { useRealtimeRefresh } from "@/hooks/useRealtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  projectId?: string;
  title?: string;
  description?: string;
  limit?: number;
  className?: string;
}

export function ActivityFeed({
  projectId,
  title = "Live activity",
  description = "Streams over a WebSocket. On reconnect the last 20 events are re-read from the database.",
  limit = 20,
  className,
}: Props) {
  const query = useQuery({
    queryKey: ["activity", projectId ?? "all", limit],
    queryFn: () =>
      listActivity({ data: { ...(projectId ? { projectId } : {}), limit } }) as Promise<
        ActivityEntry[]
      >,
  });

  useRealtimeRefresh(
    ["task_activity", "tasks"],
    ["activity", "tasks", "stats"],
    `activity-${projectId ?? "global"}`,
  );

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-2 animate-ping rounded-full bg-success/70" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          {title}
        </CardTitle>
        <CardDescription className="flex items-start gap-1.5 text-xs">
          <Radio className="mt-0.5 size-3.5 shrink-0" />
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (query.data?.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ScrollArea className="h-[26rem] pr-3">
            <ol className="space-y-3">
              {query.data?.map((entry) => (
                <li key={entry.id} className="border-b border-border/70 pb-3 last:border-0">
                  <p className="text-sm leading-snug">
                    {describeActivity(entry)}{" "}
                    <span className="text-muted-foreground">· {timeAgo(entry.created_at)}</span>
                  </p>
                  {entry.project_name && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{entry.project_name}</p>
                  )}
                </li>
              ))}
            </ol>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
