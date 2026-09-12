import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listTasks } from "@/lib/dashboard.functions";
import type { Task, TaskPriority, TaskStatus } from "@/lib/domain";
import { PRIORITY_ORDER, STATUS_ORDER } from "@/lib/domain";
import { AppShell } from "@/components/AppShell";
import { TaskFilters, type TaskSearch } from "@/components/TaskFilters";
import { TaskTable } from "@/components/TaskTable";
import { useRealtimeRefresh } from "@/hooks/useRealtime";
import { Skeleton } from "@/components/ui/skeleton";

function parseList<T extends string>(value: unknown, allowed: readonly T[]): T[] | undefined {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const parsed = raw.filter((item): item is T => allowed.includes(item as T));
  return parsed.length ? parsed : undefined;
}

function parseDate(value: unknown): string | undefined {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — Studio Ops" },
      { name: "description", content: "Filter tasks by status, priority and due date range." },
      { property: "og:title", content: "Tasks — Studio Ops" },
      {
        property: "og:description",
        content: "Filter tasks by status, priority and due date range.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): TaskSearch => ({
    status: parseList<TaskStatus>(search["status"], STATUS_ORDER),
    priority: parseList<TaskPriority>(search["priority"], PRIORITY_ORDER),
    dueFrom: parseDate(search["dueFrom"]),
    dueTo: parseDate(search["dueTo"]),
  }),
  component: TasksPage,
});

function TasksPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const query = useQuery({
    queryKey: ["tasks", search],
    queryFn: () =>
      listTasks({
        data: {
          ...(search.status ? { status: search.status } : {}),
          ...(search.priority ? { priority: search.priority } : {}),
          ...(search.dueFrom ? { dueFrom: search.dueFrom } : {}),
          ...(search.dueTo ? { dueTo: search.dueTo } : {}),
        },
      }) as Promise<Task[]>,
  });

  useRealtimeRefresh(["tasks"], ["tasks", "stats"], "tasks-list");

  return (
    <AppShell
      title="Tasks"
      subtitle="Filters are stored in the address bar, so any view can be shared as a link."
    >
      <TaskFilters
        search={search}
        onChange={(next) => void navigate({ search: next, replace: true })}
      />
      {query.isLoading ? <Skeleton className="h-72 w-full" /> : <TaskTable tasks={query.data ?? []} />}
    </AppShell>
  );
}
