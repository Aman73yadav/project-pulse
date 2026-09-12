import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  STATUS_LABEL,
  STATUS_ORDER,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/domain";

export interface TaskSearch {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  dueFrom?: string;
  dueTo?: string;
}

/**
 * Filters live in the URL query string, so any filtered view is a shareable link.
 */
export function TaskFilters({
  search,
  onChange,
}: {
  search: TaskSearch;
  onChange: (next: TaskSearch) => void;
}) {
  const status = search.status ?? [];
  const priority = search.priority ?? [];

  function toggle<T extends string>(list: T[], value: T): T[] | undefined {
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
    return next.length ? next : undefined;
  }

  const active =
    status.length > 0 || priority.length > 0 || Boolean(search.dueFrom) || Boolean(search.dueTo);

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start gap-6">
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {STATUS_ORDER.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ ...search, status: toggle(status, value) })}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  status.includes(value)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-secondary",
                )}
              >
                {STATUS_LABEL[value]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Priority</Label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRIORITY_ORDER.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ ...search, priority: toggle(priority, value) })}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  priority.includes(value)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-secondary",
                )}
              >
                {PRIORITY_LABEL[value]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-end gap-3">
          <div>
            <Label htmlFor="dueFrom" className="text-xs uppercase tracking-wide text-muted-foreground">
              Due from
            </Label>
            <Input
              id="dueFrom"
              type="date"
              className="mt-2 w-40"
              value={search.dueFrom ?? ""}
              onChange={(e) => onChange({ ...search, dueFrom: e.target.value || undefined })}
            />
          </div>
          <div>
            <Label htmlFor="dueTo" className="text-xs uppercase tracking-wide text-muted-foreground">
              Due to
            </Label>
            <Input
              id="dueTo"
              type="date"
              className="mt-2 w-40"
              value={search.dueTo ?? ""}
              onChange={(e) => onChange({ ...search, dueTo: e.target.value || undefined })}
            />
          </div>
        </div>

        {active && (
          <Button variant="ghost" size="sm" className="self-end" onClick={() => onChange({})}>
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
