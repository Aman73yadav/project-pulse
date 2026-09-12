import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { updateTaskStatus } from "@/lib/dashboard.functions";
import { readableError } from "@/lib/api-error";
import { STATUS_LABEL, type Task, type TaskStatus } from "@/lib/domain";
import { allowedStatuses } from "@/lib/workflow";
import { useMe } from "@/hooks/useMe";
import { OverdueBadge, PriorityBadge, StatusBadge } from "@/components/badges";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function TaskTable({
  tasks,
  showProject = true,
  emptyMessage = "No tasks match these filters.",
}: {
  tasks: Task[];
  showProject?: boolean;
  emptyMessage?: string;
}) {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const role = me?.role ?? "developer";
  const changeStatus = useMutation({
    mutationFn: (input: { id: string; status: TaskStatus }) => updateTaskStatus({ data: input }),
    onSuccess: (_data, input) => {
      toast.success(`Moved to ${STATUS_LABEL[input.status]}`);
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error) => toast.error(readableError(error)),
  });

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">#</TableHead>
            <TableHead>Task</TableHead>
            {showProject && <TableHead>Project</TableHead>}
            <TableHead>Assignee</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Due</TableHead>
            <TableHead className="w-44">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id}>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {task.task_number}
              </TableCell>
              <TableCell className="max-w-80">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/task/$taskId"
                    params={{ taskId: task.id }}
                    className="font-medium hover:text-primary hover:underline"
                  >
                    {task.title}
                  </Link>
                  {task.is_overdue && <OverdueBadge />}
                </div>
                {task.description && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {task.description}
                  </p>
                )}
              </TableCell>
              {showProject && (
                <TableCell className="text-sm">
                  <Link
                    to="/projects/$projectId"
                    params={{ projectId: task.project_id }}
                    className="text-primary hover:underline"
                  >
                    {task.project_name ?? "—"}
                  </Link>
                </TableCell>
              )}
              <TableCell className="text-sm">{task.assignee_name ?? "Unassigned"}</TableCell>
              <TableCell>
                <PriorityBadge priority={task.priority} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(task.due_date)}
              </TableCell>
              <TableCell>
                <Select
                  value={task.status}
                  onValueChange={(value) =>
                    changeStatus.mutate({ id: task.id, status: value as TaskStatus })
                  }
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue>
                      <StatusBadge status={task.status} />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {allowedStatuses(role, task.status).map((status) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_LABEL[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
