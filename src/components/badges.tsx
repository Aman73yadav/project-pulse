import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PRIORITY_LABEL,
  ROLE_LABEL,
  STATUS_LABEL,
  type AppRole,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/domain";

const STATUS_STYLE: Record<TaskStatus, string> = {
  todo: "bg-secondary text-secondary-foreground border-border",
  in_progress: "bg-info/15 text-info border-info/30",
  in_review: "bg-warning/20 text-warning-foreground border-warning/40",
  done: "bg-success/15 text-success border-success/30",
};

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  low: "bg-secondary text-muted-foreground border-border",
  medium: "bg-info/10 text-info border-info/25",
  high: "bg-warning/20 text-warning-foreground border-warning/40",
  critical: "bg-destructive/12 text-destructive border-destructive/30",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_STYLE[status])}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <Badge variant="outline" className={cn("font-medium", PRIORITY_STYLE[priority])}>
      {PRIORITY_LABEL[priority]}
    </Badge>
  );
}

export function OverdueBadge() {
  return (
    <Badge variant="outline" className="border-destructive/40 bg-destructive/12 text-destructive">
      Overdue
    </Badge>
  );
}

export function RoleBadge({ role }: { role: AppRole | null }) {
  if (!role) return <Badge variant="outline">No role</Badge>;
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        role === "admin" && "border-primary/35 bg-primary/10 text-primary",
        role === "project_manager" && "border-info/30 bg-info/12 text-info",
        role === "developer" && "border-border bg-secondary text-secondary-foreground",
      )}
    >
      {ROLE_LABEL[role]}
    </Badge>
  );
}
