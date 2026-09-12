import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createProject, listClients, listProjects } from "@/lib/dashboard.functions";
import { readableError } from "@/lib/api-error";
import type { Client, Project } from "@/lib/domain";
import { AppShell } from "@/components/AppShell";
import { useMe } from "@/hooks/useMe";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [
      { title: "Projects — Studio Ops" },
      { name: "description", content: "Client projects, task counts and overdue flags." },
      { property: "og:title", content: "Projects — Studio Ops" },
      { property: "og:description", content: "Client projects, task counts and overdue flags." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectsPage,
});

function NewProjectDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState<string>("");

  const clients = useQuery({
    queryKey: ["clients"],
    queryFn: () => listClients() as Promise<Client[]>,
  });

  const create = useMutation({
    mutationFn: () =>
      createProject({
        data: {
          name: name.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(clientId ? { client_id: clientId } : {}),
        },
      }),
    onSuccess: () => {
      toast.success("Project created");
      setOpen(false);
      setName("");
      setDescription("");
      setClientId("");
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (error) => toast.error(readableError(error)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> New project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            You will own this project. Other project managers will not see it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Name</Label>
            <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-client">Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger id="project-client">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.data?.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={name.trim().length < 2 || create.isPending}
            onClick={() => create.mutate()}
          >
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectsPage() {
  const { data: me } = useMe();
  const canCreate = me?.role === "admin" || me?.role === "project_manager";

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects() as Promise<Project[]>,
  });

  return (
    <AppShell
      title="Projects"
      subtitle="Project managers see only the projects they created."
      actions={canCreate ? <NewProjectDialog /> : undefined}
    >
      {projects.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (projects.data?.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No projects visible to you yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.data?.map((project) => (
            <Card key={project.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  <Link
                    to="/projects/$projectId"
                    params={{ projectId: project.id }}
                    className="hover:text-primary hover:underline"
                  >
                    {project.name}
                  </Link>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {project.client_name ?? "No client"} · owner {project.owner_name ?? "—"}
                </p>
              </CardHeader>
              <CardContent>
                {project.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {project.description}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  <span>
                    <strong>{project.task_count}</strong>{" "}
                    <span className="text-muted-foreground">tasks</span>
                  </span>
                  <span>
                    <strong>{project.open_count}</strong>{" "}
                    <span className="text-muted-foreground">open</span>
                  </span>
                  <span className={project.overdue_count > 0 ? "text-destructive" : ""}>
                    <strong>{project.overdue_count}</strong>{" "}
                    <span className="text-muted-foreground">overdue</span>
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
