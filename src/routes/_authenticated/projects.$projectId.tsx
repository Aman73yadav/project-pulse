import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createTask, getProject, listTasks } from "@/lib/dashboard.functions";
import { readableError } from "@/lib/api-error";
import {
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  type Project,
  type Task,
  type TaskPriority,
  type TeamMember,
} from "@/lib/domain";
import { AppShell } from "@/components/AppShell";
import { ActivityFeed } from "@/components/ActivityFeed";
import { TaskTable } from "@/components/TaskTable";
import { useMe, useTeam } from "@/hooks/useMe";
import { useRealtimeRefresh } from "@/hooks/useRealtime";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  head: () => ({
    meta: [
      { title: "Project — Studio Ops" },
      { name: "description", content: "Project tasks and live activity for this client project." },
      { property: "og:title", content: "Project — Studio Ops" },
      {
        property: "og:description",
        content: "Project tasks and live activity for this client project.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectDetailPage,
});

function NewTaskDialog({ projectId, team }: { projectId: string; team: TeamMember[] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createTask({
        data: {
          project_id: projectId,
          title: title.trim(),
          status: "todo",
          priority,
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(assignee ? { assignee_id: assignee } : {}),
          ...(dueDate ? { due_date: dueDate } : {}),
        },
      }),
    onSuccess: () => {
      toast.success("Task created");
      setOpen(false);
      setTitle("");
      setDescription("");
      setAssignee("");
      setDueDate("");
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (error) => toast.error(readableError(error)),
  });

  const developers = team.filter((member) => member.role === "developer");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> New task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-assignee">Developer</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger id="task-assignee">
                  <SelectValue placeholder="Assign" />
                </SelectTrigger>
                <SelectContent>
                  {developers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-priority">Priority</Label>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as TaskPriority)}
              >
                <SelectTrigger id="task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_ORDER.map((value) => (
                    <SelectItem key={value} value={value}>
                      {PRIORITY_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Due date</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={title.trim().length < 2 || create.isPending}
            onClick={() => create.mutate()}
          >
            Create task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const { data: me } = useMe();
  const { data: team } = useTeam(me?.role === "admin" || me?.role === "project_manager");

  const project = useQuery({
    queryKey: ["projects", projectId],
    queryFn: () => getProject({ data: { id: projectId } }) as Promise<Project>,
  });

  const tasks = useQuery({
    queryKey: ["tasks", { projectId }],
    queryFn: () => listTasks({ data: { projectId } }) as Promise<Task[]>,
  });

  useRealtimeRefresh(["tasks"], ["tasks", "projects", "stats"], `project-${projectId}`);

  const canCreate = me?.role === "admin" || me?.role === "project_manager";

  return (
    <AppShell
      title={project.data?.name ?? "Project"}
      subtitle={
        project.data
          ? `${project.data.client_name ?? "No client"} · owner ${project.data.owner_name ?? "—"}`
          : undefined
      }
      actions={
        canCreate && project.data ? (
          <NewTaskDialog projectId={projectId} team={team ?? []} />
        ) : undefined
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div>
          {tasks.isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <TaskTable
              tasks={tasks.data ?? []}
              showProject={false}
              emptyMessage="No tasks on this project yet."
            />
          )}
        </div>
        <ActivityFeed projectId={projectId} title="Project activity" limit={20} />
      </div>
    </AppShell>
  );
}
