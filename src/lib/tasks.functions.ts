import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { apiError, throwDbError } from "./api-error";

const uuid = z.string().uuid();
const BUCKET = "task-files";

type AnyClient = { from: (table: string) => any };

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  author_name: string | null;
  body: string;
  created_at: string;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  uploader_id: string;
  uploader_name: string | null;
  file_name: string;
  size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
}

async function people(supabase: AnyClient): Promise<Map<string, string>> {
  const { data } = await supabase.from("profiles").select("id, full_name");
  return new Map<string, string>(
    (data ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name] as [string, string]),
  );
}

/** Confirms the caller can see the task (RLS decides) and returns its project. */
async function taskScope(supabase: AnyClient, taskId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, project_id, task_number, title, status, assignee_id")
    .eq("id", taskId)
    .maybeSingle();
  if (error) throwDbError(error, "The task could not be loaded.");
  if (!data) throw apiError("NOT_FOUND", "That task does not exist or is not visible to you.");
  return data as {
    id: string;
    project_id: string;
    task_number: number;
    title: string;
    status: string;
    assignee_id: string | null;
  };
}

/* ---------------------------- comments ---------------------------- */

export const listComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ taskId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as AnyClient;
    const { data: rows, error } = await supabase
      .from("task_comments")
      .select("id, task_id, author_id, body, created_at")
      .eq("task_id", data.taskId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throwDbError(error, "Comments could not be loaded.");
    const names = await people(supabase);
    return (rows ?? []).map(
      (r: Record<string, unknown>): TaskComment => ({
        id: r["id"] as string,
        task_id: r["task_id"] as string,
        author_id: r["author_id"] as string,
        author_name: names.get(r["author_id"] as string) ?? null,
        body: r["body"] as string,
        created_at: r["created_at"] as string,
      }),
    );
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ taskId: uuid, body: z.string().trim().min(1).max(4000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as AnyClient;
    const task = await taskScope(supabase, data.taskId);
    const { data: row, error } = await supabase
      .from("task_comments")
      .insert({
        task_id: task.id,
        project_id: task.project_id,
        author_id: context.userId,
        body: data.body,
      })
      .select("id")
      .single();
    if (error) throwDbError(error, "The comment could not be posted.");
    return { id: row.id as string };
  });

/* --------------------------- attachments --------------------------- */

export const listAttachments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ taskId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as AnyClient;
    const { data: rows, error } = await supabase
      .from("task_attachments")
      .select("id, task_id, uploader_id, file_name, size_bytes, mime_type, created_at")
      .eq("task_id", data.taskId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throwDbError(error, "Attachments could not be loaded.");
    const names = await people(supabase);
    return (rows ?? []).map(
      (r: Record<string, unknown>): TaskAttachment => ({
        id: r["id"] as string,
        task_id: r["task_id"] as string,
        uploader_id: r["uploader_id"] as string,
        uploader_name: names.get(r["uploader_id"] as string) ?? null,
        file_name: r["file_name"] as string,
        size_bytes: (r["size_bytes"] ?? null) as number | null,
        mime_type: (r["mime_type"] ?? null) as string | null,
        created_at: r["created_at"] as string,
      }),
    );
  });

const MAX_BYTES = 8 * 1024 * 1024;

export const uploadAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        taskId: uuid,
        fileName: z.string().trim().min(1).max(200),
        mimeType: z.string().trim().max(160).optional(),
        // base64 payload, without a data: prefix
        content: z.string().min(4).max(Math.ceil(MAX_BYTES * 1.4)),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as AnyClient;
    const task = await taskScope(supabase, data.taskId);

    const bytes = Buffer.from(data.content, "base64");
    if (bytes.byteLength === 0) throw apiError("VALIDATION_ERROR", "That file is empty.");
    if (bytes.byteLength > MAX_BYTES) {
      throw apiError("VALIDATION_ERROR", "Files must be 8 MB or smaller.");
    }

    const safeName = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const path = `${task.project_id}/${task.id}/${crypto.randomUUID()}-${safeName}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, {
      contentType: data.mimeType || "application/octet-stream",
      upsert: false,
    });
    if (uploadError) {
      console.error("[attachment upload]", uploadError);
      throw apiError("INTERNAL_ERROR", "The file could not be uploaded.");
    }

    const { data: row, error } = await supabase
      .from("task_attachments")
      .insert({
        task_id: task.id,
        project_id: task.project_id,
        uploader_id: context.userId,
        file_name: data.fileName.slice(0, 200),
        file_path: path,
        size_bytes: bytes.byteLength,
        mime_type: data.mimeType ?? null,
      })
      .select("id")
      .single();
    if (error) {
      await supabaseAdmin.storage.from(BUCKET).remove([path]);
      throwDbError(error, "The file could not be attached.");
    }
    return { id: row.id as string };
  });

export const getAttachmentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as AnyClient;
    // RLS decides whether the caller may see this attachment row at all.
    const { data: row, error } = await supabase
      .from("task_attachments")
      .select("id, file_path")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throwDbError(error, "The file could not be opened.");
    if (!row) throw apiError("NOT_FOUND", "That file is not available to you.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(row.file_path as string, 60 * 5);
    if (signError || !signed) {
      console.error("[attachment sign]", signError);
      throw apiError("INTERNAL_ERROR", "The file could not be opened.");
    }
    return { url: signed.signedUrl };
  });

export const deleteAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as AnyClient;
    const { data: rows, error } = await supabase
      .from("task_attachments")
      .delete()
      .eq("id", data.id)
      .select("file_path");
    if (error) throwDbError(error, "The file could not be removed.");
    if (!rows || rows.length === 0) throw apiError("FORBIDDEN", "You cannot remove this file.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage.from(BUCKET).remove([rows[0].file_path as string]);
    return { ok: true };
  });

/* ---------------------------- single task ---------------------------- */

export const getTask = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as AnyClient;
    const { data: row, error } = await supabase
      .from("tasks")
      .select(
        "id, task_number, project_id, title, description, assignee_id, status, priority, due_date, is_overdue, created_at, updated_at",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throwDbError(error, "The task could not be loaded.");
    if (!row) throw apiError("NOT_FOUND", "That task does not exist or is not visible to you.");

    const names = await people(supabase);
    const { data: project } = await supabase
      .from("projects")
      .select("id, name")
      .eq("id", row.project_id)
      .maybeSingle();

    return {
      ...row,
      project_name: (project?.name ?? null) as string | null,
      assignee_name: row.assignee_id ? (names.get(row.assignee_id) ?? null) : null,
    };
  });
