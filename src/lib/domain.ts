/** Shared, browser-safe domain types and labels. No server imports here. */

export type AppRole = "admin" | "project_manager" | "developer";
export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  project_manager: "Project Manager",
  developer: "Developer",
};

export const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "in_review", "done"];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};

export const PRIORITY_ORDER: TaskPriority[] = ["critical", "high", "medium", "low"];

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const PRIORITY_RANK: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: AppRole | null;
}

export interface Client {
  id: string;
  name: string;
  contact_email: string | null;
  notes: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  client_id: string | null;
  client_name: string | null;
  created_by: string;
  owner_name: string | null;
  created_at: string;
  task_count: number;
  open_count: number;
  overdue_count: number;
}

export interface Task {
  id: string;
  task_number: number;
  project_id: string;
  project_name: string | null;
  title: string;
  description: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActivityEntry {
  id: string;
  task_id: string | null;
  task_number: number | null;
  task_title: string | null;
  project_id: string;
  project_name: string | null;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  from_status: TaskStatus | null;
  to_status: TaskStatus | null;
  detail: string | null;
  created_at: string;
}

export interface AppNotification {
  id: string;
  type: string;
  message: string;
  task_id: string | null;
  project_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface DashboardStats {
  role: AppRole | null;
  projectCount: number;
  taskCount: number;
  byStatus: Record<TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
  overdue: number;
  dueThisWeek: number;
}

export interface TaskFilters {
  projectId?: string;
  status?: TaskStatus[];
  priority?: TaskPriority[];
  dueFrom?: string;
  dueTo?: string;
  assigneeId?: string;
  overdueOnly?: boolean;
}

/** "Ravi moved Task #12 from In Progress → In Review" */
export function describeActivity(entry: ActivityEntry): string {
  const who = entry.actor_name ?? "System";
  const task =
    entry.task_number != null ? `Task #${entry.task_number}` : (entry.detail ?? "a task");
  switch (entry.action) {
    case "status_changed":
      return `${who} moved ${task} from ${STATUS_LABEL[entry.from_status ?? "todo"]} → ${
        STATUS_LABEL[entry.to_status ?? "todo"]
      }`;
    case "created":
      return `${who} created ${task}${entry.detail ? ` · ${entry.detail}` : ""}`;
    case "assigned":
      return `${who} assigned ${task}${entry.detail ? ` · ${entry.detail}` : ""}`;
    case "flagged_overdue":
      return `${task} was flagged as Overdue${entry.detail ? ` · ${entry.detail}` : ""}`;
    default:
      return `${who} updated ${task}`;
  }
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}
