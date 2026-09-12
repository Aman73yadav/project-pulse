import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, FolderKanban, ListChecks } from "lucide-react";
import { getDashboardStats, listTasks } from "@/lib/dashboard.functions";
import {
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  STATUS_LABEL,
  STATUS_ORDER,
  type DashboardStats,
  type Task,
} from "@/lib/domain";
import { AppShell } from "@/components/AppShell";
import { ActivityFeed } from "@/components/ActivityFeed";
import { TaskTable } from "@/components/TaskTable";
import { useMe } from "@/hooks/useMe";
import { useRealtimeRefresh } from "@/hooks/useRealtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Studio Ops" },
      { name: "description", content: "Project, task and live activity overview for your role." },
      { property: "og:title", content: "Dashboard — Studio Ops" },
      {
        property: "og:description",
        content: "Project, task and live activity overview for your role.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage;
});

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number | string;
  icon: typeof ListChecks;
  tone?: "default" | "danger";
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={
            tone === "danger"
              ? "rounded-lg bg-destructive/12 p-2.5 text-destructive"
              : "rounded-lg bg-primary/10 p-2.5 text-primary"
          }
        >
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold leading-none">{value}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardPage() {
  const { data: me } = useMe();
  const role = me?.role ?? "developer";

  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: () => getDashboardStats() as Promise<DashboardStats>,
  });

  const myTasks = useQuery({
    queryKey: ["tasks", "dashboard", role],
    queryFn: () =>
      listTasks({
        data: role === "developer" ? { assignedToMe: true } : { limit: 8 },
      }) as Promise<Task[]>,
  });

  useRealtimeRefresh(["tasks", "task_activity"], ["stats", "tasks"], "dashboard-stats");

  const title =
    role === "admin"
      ? "Studio overview"
      : role === "project_manager"
        ? "My projects"
        : "My work";

  return (
    <AppShell
      title={title}
      subtitle={
        role === "admin"
          ? "Everything across the studio, live."
          : role === "project_manager"
            ? "Only the projects you own — enforced by the database."
            : "Only the tasks assigned to you — enforced by the database."
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.isLoading || !stats.data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : (
          <>
            <StatCard label="Projects" value={stats.data.projectCount} icon={FolderKanban} />
            <StatCard label="Tasks" value={stats.data.taskCount} icon={ListChecks} />
            <StatCard
              label="Overdue"
              value={stats.data.overdueCount}
              icon={AlertTriangle}
              tone="danger"
            />
            <StatCard label="Due this week" value={stats.data.dueThisWeek} icon={CalendarClock} />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {role === "developer" ? "Tasks by priority" : "Task pipeline"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                {STATUS_ORDER.map((status) => (
                  <div key={status} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{STATUS_LABEL[status]}</span>
                    <span className="font-medium">{stats.data?.byStatus[status] ?? 0}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {PRIORITY_ORDER.map((priority) => (
                  <div key={priority} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{PRIORITY_LABEL[priority]}</span>
                    <span className="font-medium">{stats.data?.byPriority[priority] ?? 0}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {role === "developer" ? "Assigned to me" : "Recent tasks"}
              </h2>
              <Link to="/tasks" className="text-sm text-primary hover:underline">
                View all tasks
              </Link>
            </div>
            {myTasks.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <TaskTable tasks={myTasks.data ?? []} />
            )}
          </div>
        </div>

        <ActivityFeed limit={20} />
      </div>
    </AppShell>
  );
}
