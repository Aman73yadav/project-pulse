import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { apiError, throwDbError } from "./api-error";
import type {
  ActivityEntry,
  AppNotification,
  AppRole,
  Client,
  Project,
  Task,
  TaskPriority,
  TaskStatus,
  TeamMember,
} from "./domain";
import { PRIORITY_RANK } from "./domain";

/* ------------------------------------------------------------------ */
/* validation schemas                                                  */
/* ------------------------------------------------------------------ */

const statusEnum = z.enum(["todo", "in_progress", "in_review", "done"]);
const priorityEnum = z.enum(["low", "medium", "high", "critical"]);
const uuid = z.string().uuid();

const taskFilterSchema = z.object({
  projectId: uuid.optional(),
  status: z.array(statusEnum).max(4).optional(),
  priority: z.array(priorityEnum).max(4).optional(),
  dueFrom: z.string().min(4).max(40).optional(),
  dueTo: z.string().min(4).max(40).optional(),
  assigneeId: uuid.optional(),
  overdueOnly: z.boolean().optional(),
});

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

type AnyClient = {
  from: (table: string) => any;
};

async function loadPeople(supabase: AnyClient): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("profiles").select("id, full_name");
  if (error) throwDbError(error, "Team members could not be loaded.");
  return new Map<string, string>(
    (data ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name] as [string, string]),
  );
}

async function loadRole(supabase: AnyClient, userId: string): Promise<AppRole | null> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throwDbError(error, "Your role could not be loaded.");
  const roles = (data ?? []).map((r: { role: AppRole }) => r.role);
  if (roles.includes("admin")) return "admin";
  if (roles.includes("project_manager")) return "project_manager";
  if (roles.includes("developer")) return "developer";
  return null;
}

/* ------------------------------------------------------------------ */
/* session                                                             */
/* ------------------------------------------------------------------ */

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as unknown as AnyClient;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throwDbError(error, "Your profile could not be loaded.");
    let role = await loadRole(supabase, context.userId);
    let profile = data as { full_name: string; email: string } | null;

    // Self-heal accounts that exist in auth but have no profile row or role yet
    // (for example the very first person to sign in on a fresh database).
    if (!profile || !role) {
      const claims = context.claims as { email?: string; user_metadata?: { full_name?: string } };
      const email = claims?.email ?? "";
      const fullName =
        profile?.full_name || claims?.user_metadata?.full_name || email.split("@")[0] || "Team member";

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = supabaseAdmin as unknown as AnyClient;

      if (!profile) {
        await db
          .from("profiles")
          .upsert({ id: context.userId, full_name: fullName, email }, { onConflict: "id" });
        profile = { full_name: fullName, email };
      }
      if (!role) {
        const { count } = await db
          .from("user_roles")
          .select("id", { count: "exact", head: true })
          .eq("role", "admin");
        role = (count ?? 0) === 0 ? "admin" : "developer";
        await db
          .from("user_roles")
          .upsert({ user_id: context.userId, role }, { onConflict: "user_id,role" });
      }
    }

    return {
      id: context.userId,
      full_name: profile?.full_name ?? "Team member",
      email: profile?.email ?? "",
      role,
    } satisfies TeamMember;
  });

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as unknown as AnyClient;
    const [{ data: profiles, error }, { data: roles, error: roleError }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email").order("full_name"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (error) throwDbError(error, "The team could not be loaded.");
    if (roleError) throwDbError(roleError, "Roles could not be loaded.");
    const roleMap = new Map<string, AppRole>();
    for (const row of roles ?? []) roleMap.set(row.user_id, row.role);
    return (profiles ?? []).map(
      (p: { id: string; full_name: string; email: string }): TeamMember => ({
        ...p,
        role: roleMap.get(p.id) ?? null,
      }),
    );
  });

/* ------------------------------------------------------------------ */
/* clients                                                             */
/* ------------------------------------------------------------------ */

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as unknown as AnyClient;
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, contact_email, notes, created_at")
      .order("name");
    if (error) throwDbError(error, "Clients could not be loaded.");
    return (data ?? []) as Client[];
  });

export const createClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(120),
        contact_email: z.string().trim().email().max(160).optional().or(z.literal("")),
        notes: z.string().trim().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as AnyClient;
    const { data: row, error } = await supabase
      .from("clients")
      .insert({
        name: data.name,
        contact_email: data.contact_email ? data.contact_email : null,
        notes: data.notes ?? null,
      })
      .select("id")
      .single();
    if (error) throwDbError(error, "The client could not be created.");
    return { id: row.id as string };
  });

/* ------------------------------------------------------------------ */
/* projects                                                            */
/* ------------------------------------------------------------------ */

async function buildProjects(supabase: AnyClient): Promise<Project[]> {
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, description, status, client_id, created_by, created_at")
    .order("created_at", { ascending: false });
  if (error) throwDbError(error, "Projects could not be loaded.");
  const rows = projects ?? [];
  if (rows.length === 0) return [];

  const people = await loadPeople(supabase);
  const { data: clients } = await supabase.from("clients").select("id, name");
  const clientMap = new Map<string, string>(
    (clients ?? []).map((c: { id: string; name: string }) => [c.id, c.name] as [string, string]),
  );

  const { data: tasks, error: taskError } = await supabase
    .from("tasks")
    .select("project_id, status, is_overdue");
  if (taskError) throwDbError(taskError, "Task counts could not be loaded.");

  return rows.map((p: Record<string, unknown>) => {
    const projectTasks = (tasks ?? []).filter(
      (t: { project_id: string }) => t.project_id === p['id'],
    );
    return {
      id: p['id'] as string,
      name: p['name'] as string,
      description: (p['description'] ?? null) as string | null,
      status: p['status'] as string,
      client_id: (p['client_id'] ?? null) as string | null,
      client_name: p['client_id'] ? (clientMap.get(p['client_id'] as string) ?? null) : null,
      created_by: p['created_by'] as string,
      owner_name: people.get(p['created_by'] as string) ?? null,
      created_at: p['created_at'] as string,
      task_count: projectTasks.length,
      open_count: projectTasks.filter((t: { status: TaskStatus }) => t.status !== "done").length,
      overdue_count: projectTasks.filter((t: { is_overdue: boolean }) => t.is_overdue).length,
    };
  });
}

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => buildProjects(context.supabase as unknown as AnyClient));

export const getProject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as AnyClient;
    const all = await buildProjects(supabase);
    const project = all.find((p) => p.id === data.id);
    if (!project) throw apiError("NOT_FOUND", "That project does not exist or is not visible to you.");
    return project;
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(140),
        description: z.string().trim().max(2000).optional(),
        client_id: uuid.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as AnyClient;
    const role = await loadRole(supabase, context.userId);
    if (role !== "admin" && role !== "project_manager") {
      throw apiError("FORBIDDEN", "Only admins and project managers can create projects.");
    }
    const { data: row, error } = await supabase
      .from("projects")
      .insert({
        name: data.name,
        description: data.description ?? null,
        client_id: data.client_id ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throwDbError(error, "The project could not be created.");
    return { id: row.id as string };
  });

/* ------------------------------------------------------------------ */
/* tasks                                                               */
/* ------------------------------------------------------------------ */

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => taskFilterSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as AnyClient;
    let query = supabase
      .from("tasks")
      .select(
        "id, task_number, project_id, title, description, assignee_id, status, priority, due_date, is_overdue, created_at, updated_at",
      );

    if (data.projectId) query = query.eq("project_id", data.projectId);
    if (data.assigneeId) query = query.eq("assignee_id", data.assigneeId);
    if (data.status?.length) query = query.in("status", data.status);
    if (data.priority?.length) query = query.in("priority", data.priority);
    if (data.dueFrom) query = query.gte("due_date", new Date(data.dueFrom).toISOString());
    if (data.dueTo) query = query.lte("due_date", new Date(data.dueTo).toISOString());
    if (data.overdueOnly) query = query.eq("is_overdue", true);

    const { data: rows, error } = await query.limit(500);
    if (error) throwDbError(error, "Tasks could not be loaded.");

    const people = await loadPeople(supabase);
    const { data: projects } = await supabase.from("projects").select("id, name");
    const projectMap = new Map<string, string>(
      (projects ?? []).map((p: { id: string; name: string }) => [p.id, p.name] as [string, string]),
    );

    const tasks: Task[] = (rows ?? []).map((t: Record<string, unknown>) => ({
      id: t['id'] as string,
      task_number: t['task_number'] as number,
      project_id: t['project_id'] as string,
      project_name: projectMap.get(t['project_id'] as string) ?? null,
      title: t['title'] as string,
      description: (t['description'] ?? null) as string | null,
      assignee_id: (t['assignee_id'] ?? null) as string | null,
      assignee_name: t['assignee_id'] ? (people.get(t['assignee_id'] as string) ?? null) : null,
      status: t['status'] as TaskStatus,
      priority: t['priority'] as TaskPriority,
      due_date: (t['due_date'] ?? null) as string | null,
      is_overdue: Boolean(t['is_overdue']),
      created_at: t['created_at'] as string,
      updated_at: t['updated_at'] as string,
    }));

    // priority first, then soonest due date
    tasks.sort((a, b) => {
      const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (byPriority !== 0) return byPriority;
      const aDue = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    });
    return tasks;
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        project_id: uuid,
        title: z.string().trim().min(2).max(160),
        description: z.string().trim().max(4000).optional(),
        assignee_id: uuid.optional(),
        status: statusEnum.default("todo"),
        priority: priorityEnum.default("medium"),
        due_date: z.string().min(4).max(40).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as AnyClient;
    const { data: row, error } = await supabase
      .from("tasks")
      .insert({
        project_id: data.project_id,
        title: data.title,
        description: data.description ?? null,
        assignee_id: data.assignee_id ?? null,
        status: data.status,
        priority: data.priority,
        due_date: data.due_date ? new Date(data.due_date).toISOString() : null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throwDbError(error, "The task could not be created.");
    return { id: row.id as string };
  });

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: uuid,
        title: z.string().trim().min(2).max(160).optional(),
        description: z.string().trim().max(4000).nullable().optional(),
        assignee_id: uuid.nullable().optional(),
        priority: priorityEnum.optional(),
        due_date: z.string().min(4).max(40).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as AnyClient;
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch['title'] = data.title;
    if (data.description !== undefined) patch['description'] = data.description;
    if (data.assignee_id !== undefined) patch['assignee_id'] = data.assignee_id;
    if (data.priority !== undefined) patch['priority'] = data.priority;
    if (data.due_date !== undefined) {
      patch['due_date'] = data.due_date ? new Date(data.due_date).toISOString() : null;
    }
    if (Object.keys(patch).length === 0) {
      throw apiError("VALIDATION_ERROR", "Nothing to update.");
    }
    const { data: rows, error } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", data.id)
      .select("id");
    if (error) throwDbError(error, "The task could not be updated.");
    if (!rows || rows.length === 0) {
      throw apiError("FORBIDDEN", "You cannot edit this task.");
    }
    return { id: data.id };
  });

export const updateTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: uuid, status: statusEnum }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as AnyClient;
    const { data: rows, error } = await supabase
      .from("tasks")
      .update({ status: data.status, is_overdue: data.status === "done" ? false : undefined })
      .eq("id", data.id)
      .select("id");
    if (error) throwDbError(error, "The status could not be changed.");
    if (!rows || rows.length === 0) {
      throw apiError("FORBIDDEN", "You cannot change this task.");
    }
    return { id: data.id, status: data.status };
  });

/* ------------------------------------------------------------------ */
/* activity feed                                                       */
/* ------------------------------------------------------------------ */

export const listActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ projectId: uuid.optional(), limit: z.number().int().min(1).max(100).default(20) })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as AnyClient;
    let query = supabase
      .from("task_activity")
      .select("id, task_id, project_id, actor_id, action, from_status, to_status, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.projectId) query = query.eq("project_id", data.projectId);

    const { data: rows, error } = await query;
    if (error) throwDbError(error, "The activity feed could not be loaded.");

    const people = await loadPeople(supabase);
    const { data: projects } = await supabase.from("projects").select("id, name");
    const projectMap = new Map<string, string>(
      (projects ?? []).map((p: { id: string; name: string }) => [p.id, p.name] as [string, string]),
    );
    const taskIds = [...new Set((rows ?? []).map((r: { task_id: string | null }) => r.task_id).filter(Boolean))];
    const taskMap = new Map<string, { task_number: number; title: string }>();
    if (taskIds.length > 0) {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, task_number, title")
        .in("id", taskIds as string[]);
      for (const t of tasks ?? []) taskMap.set(t.id, { task_number: t.task_number, title: t.title });
    }

    return (rows ?? []).map((r: Record<string, unknown>): ActivityEntry => {
      const task = r['task_id'] ? taskMap.get(r['task_id'] as string) : undefined;
      return {
        id: r['id'] as string,
        task_id: (r['task_id'] ?? null) as string | null,
        task_number: task?.task_number ?? null,
        task_title: task?.title ?? null,
        project_id: r['project_id'] as string,
        project_name: projectMap.get(r['project_id'] as string) ?? null,
        actor_id: (r['actor_id'] ?? null) as string | null,
        actor_name: r['actor_id'] ? (people.get(r['actor_id'] as string) ?? null) : null,
        action: r['action'] as string,
        from_status: (r['from_status'] ?? null) as TaskStatus | null,
        to_status: (r['to_status'] ?? null) as TaskStatus | null,
        detail: (r['detail'] ?? null) as string | null,
        created_at: r['created_at'] as string,
      };
    });
  });

/* ------------------------------------------------------------------ */
/* notifications                                                       */
/* ------------------------------------------------------------------ */

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as unknown as AnyClient;
    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, message, task_id, project_id, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throwDbError(error, "Notifications could not be loaded.");
    return (data ?? []) as AppNotification[];
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ids: z.array(uuid).max(100).optional(), all: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as AnyClient;
    let query = supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);
    if (!data.all) {
      if (!data.ids?.length) throw apiError("VALIDATION_ERROR", "No notifications selected.");
      query = query.in("id", data.ids);
    }
    const { error } = await query;
    if (error) throwDbError(error, "Notifications could not be updated.");
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* dashboard stats                                                     */
/* ------------------------------------------------------------------ */

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as unknown as AnyClient;
    const role = await loadRole(supabase, context.userId);

    const { data: tasks, error } = await supabase
      .from("tasks")
      .select("id, status, priority, due_date, is_overdue, assignee_id, project_id");
    if (error) throwDbError(error, "Dashboard data could not be loaded.");

    const { count: projectCount, error: projectError } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true });
    if (projectError) throwDbError(projectError, "Dashboard data could not be loaded.");

    const rows = (tasks ?? []) as Array<{
      status: TaskStatus;
      priority: TaskPriority;
      due_date: string | null;
      is_overdue: boolean;
    }>;

    const byStatus: Record<TaskStatus, number> = {
      todo: 0,
      in_progress: 0,
      in_review: 0,
      done: 0,
    };
    const byPriority: Record<TaskPriority, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    let overdue = 0;
    let dueThisWeek = 0;
    const weekAhead = Date.now() + 7 * 24 * 60 * 60 * 1000;

    for (const t of rows) {
      byStatus[t.status] += 1;
      byPriority[t.priority] += 1;
      if (t.is_overdue) overdue += 1;
      if (t.due_date && t.status !== "done") {
        const due = new Date(t.due_date).getTime();
        if (due >= Date.now() && due <= weekAhead) dueThisWeek += 1;
      }
    }

    return {
      role,
      projectCount: projectCount ?? 0,
      taskCount: rows.length,
      byStatus,
      byPriority,
      overdue,
      dueThisWeek,
    };
  });

