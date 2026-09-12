import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Paperclip, Send, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { OverdueBadge, PriorityBadge, StatusBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMe } from "@/hooks/useMe";
import { useRealtimeRefresh } from "@/hooks/useRealtime";
import { readableError } from "@/lib/api-error";
import { STATUS_LABEL, timeAgo, type TaskStatus } from "@/lib/domain";
import { updateTaskStatus } from "@/lib/dashboard.functions";
import {
  addComment,
  deleteAttachment,
  getAttachmentUrl,
  getTask,
  listAttachments,
  listComments,
  type TaskAttachment,
  type TaskComment,
} from "@/lib/tasks.functions";
import { allowedStatuses } from "@/lib/workflow";

export const Route = createFileRoute("/_authenticated/task/$taskId")({
  head: () => ({
    meta: [
      { title: "Task detail — Studio Ops" },
      {
        name: "description",
        content: "Task detail with discussion, submitted files and the approval workflow.",
      },
      { property: "og:title", content: "Task detail — Studio Ops" },
      {
        property: "og:description",
        content: "Task detail with discussion, submitted files and the approval workflow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TaskDetailPage,
});

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TaskDetailPage() {
  const { taskId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const fileInput = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [uploading, setUploading] = useState(false);

  const task = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => getTask({ data: { id: taskId } }),
  });
  const comments = useQuery({
    queryKey: ["comments", taskId],
    queryFn: () => listComments({ data: { taskId } }) as Promise<TaskComment[]>,
  });
  const attachments = useQuery({
    queryKey: ["attachments", taskId],
    queryFn: () => listAttachments({ data: { taskId } }) as Promise<TaskAttachment[]>,
  });

  useRealtimeRefresh(
    ["tasks", "task_comments", "task_attachments"],
    ["task", "comments", "attachments", "activity"],
    `task-${taskId}`,
  );

  const post = useMutation({
    mutationFn: () => addComment({ data: { taskId, body: body.trim() } }),
    onSuccess: () => {
      setBody("");
      void queryClient.invalidateQueries({ queryKey: ["comments", taskId] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
    onError: (error) => toast.error(readableError(error)),
  });

  const changeStatus = useMutation({
    mutationFn: (status: TaskStatus) => updateTaskStatus({ data: { id: taskId, status } }),
    onSuccess: (_d, status) => {
      toast.success(`Moved to ${STATUS_LABEL[status]}`);
      void queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
    onError: (error) => toast.error(readableError(error)),
  });

  const removeFile = useMutation({
    mutationFn: (id: string) => deleteAttachment({ data: { id } }),
    onSuccess: () => {
      toast.success("File removed");
      void queryClient.invalidateQueries({ queryKey: ["attachments", taskId] });
    },
    onError: (error) => toast.error(readableError(error)),
  });

  async function upload(file: File) {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Files must be 8 MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      const { uploadAttachment } = await import("@/lib/tasks.functions");
      await uploadAttachment({
        data: {
          taskId,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          content: btoa(binary),
        },
      });
      toast.success("File attached");
      void queryClient.invalidateQueries({ queryKey: ["attachments", taskId] });
    } catch (error) {
      toast.error(readableError(error));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function open(id: string) {
    try {
      const { url } = await getAttachmentUrl({ data: { id } });
      window.open(url, "_blank", "noopener");
    } catch (error) {
      toast.error(readableError(error));
    }
  }

  const data = task.data;
  const role = me?.role ?? "developer";
  const options = data ? allowedStatuses(role, data.status as TaskStatus) : [];

  return (
    <AppShell
      title={data ? `#${data.task_number} ${data.title}` : "Task"}
      subtitle={
        data?.project_name
          ? `Project: ${data.project_name}`
          : "Discussion, submitted files and status."
      }
    >
      {task.isLoading || !data ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center gap-2">
                <StatusBadge status={data.status as TaskStatus} />
                <PriorityBadge priority={data.priority} />
                {data.is_overdue && <OverdueBadge />}
                <div className="ml-auto w-48">
                  <Select
                    value={data.status}
                    onValueChange={(value) => changeStatus.mutate(value as TaskStatus)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Change status" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((status) => (
                        <SelectItem key={status} value={status}>
                          {STATUS_LABEL[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  {data.description || "No description was added."}
                </p>
                <p className="text-muted-foreground">
                  Assigned to{" "}
                  <span className="font-medium text-foreground">
                    {data.assignee_name ?? "nobody yet"}
                  </span>
                  {data.due_date
                    ? ` · due ${new Date(data.due_date).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}`
                    : ""}
                </p>
                {role === "developer" && (
                  <p className="rounded-md bg-secondary p-3 text-xs text-muted-foreground">
                    Move your work to <strong>In Review</strong> when it is ready. Only a project
                    manager or admin can mark it Done.
                  </p>
                )}
                <Link to="/tasks" className="inline-block text-xs text-primary hover:underline">
                  ← Back to all tasks
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Discussion</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {comments.isLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : (comments.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No comments yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {(comments.data ?? []).map((comment) => (
                      <li key={comment.id} className="rounded-lg border border-border p-3">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {comment.author_name ?? "Team member"}
                          </span>{" "}
                          · {timeAgo(comment.created_at)}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <form
                  className="space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (body.trim()) post.mutate();
                  }}
                >
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    maxLength={4000}
                    rows={3}
                    placeholder="Add an update for the team…"
                  />
                  <Button type="submit" size="sm" disabled={post.isPending || !body.trim()}>
                    {post.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="size-4" /> Post comment
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Files</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {attachments.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (attachments.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No files submitted yet.</p>
              ) : (
                <ul className="space-y-2">
                  {(attachments.data ?? []).map((file) => (
                    <li
                      key={file.id}
                      className="flex items-center gap-2 rounded-md border border-border p-2 text-sm"
                    >
                      <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                      <button
                        type="button"
                        onClick={() => void open(file.id)}
                        className="min-w-0 flex-1 truncate text-left text-primary hover:underline"
                      >
                        {file.file_name}
                      </button>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatSize(file.size_bytes)}
                      </span>
                      {(file.uploader_id === me?.id || role !== "developer") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remove file"
                          onClick={() => removeFile.mutate(file.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <input
                ref={fileInput}
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Paperclip className="size-4" /> Attach a file
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Up to 8 MB per file. Files are private to people who can see this task.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
