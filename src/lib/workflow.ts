import type { AppRole, TaskStatus } from "./domain";
import { STATUS_ORDER } from "./domain";

/**
 * Approval workflow, mirrored from the database trigger `guard_task_update()`.
 *
 * Managers (admin / project manager) may set any status — they own approval, so
 * only they can move a task to Done. Developers may pick up work, hand it back
 * or submit it for review, and nothing else. The database enforces this; the UI
 * simply avoids offering options that would be rejected.
 */
const DEVELOPER_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  todo: ["todo", "in_progress"],
  in_progress: ["in_progress", "todo", "in_review"],
  in_review: ["in_review", "in_progress"],
  done: ["done"],
};

export function allowedStatuses(role: AppRole | null, current: TaskStatus): TaskStatus[] {
  if (role === "admin" || role === "project_manager") return [...STATUS_ORDER];
  return DEVELOPER_TRANSITIONS[current] ?? [current];
}
