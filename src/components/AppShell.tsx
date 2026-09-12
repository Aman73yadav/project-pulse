import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, FolderKanban, ListChecks, Radio, Users, Building2, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/useMe";
import { usePresence } from "@/hooks/usePresence";
import { NotificationBell } from "@/components/NotificationBell";
import { RoleBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "project_manager", "developer"] },
  { to: "/projects", label: "Projects", icon: FolderKanban, roles: ["admin", "project_manager", "developer"] },
  { to: "/tasks", label: "Tasks", icon: ListChecks, roles: ["admin", "project_manager", "developer"] },
  { to: "/activity", label: "Activity", icon: Radio, roles: ["admin", "project_manager", "developer"] },
  { to: "/clients", label: "Clients", icon: Building2, roles: ["admin", "project_manager"] },
  { to: "/team", label: "Team", icon: Users, roles: ["admin"] },
] as const;

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const online = usePresence(me?.id, me?.full_name);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const role = me?.role ?? "developer";

  return (
    <div className="min-h-screen bg-secondary/40">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/dashboard" className="font-display text-lg font-semibold tracking-tight">
            Studio<span className="text-primary">Ops</span>
          </Link>
          <nav className="order-3 flex w-full flex-wrap gap-1 md:order-2 md:w-auto">
            {NAV.filter((item) => (item.roles as readonly string[]).includes(role)).map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:bg-secondary [&.active]:text-foreground [&.active]:font-medium"
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:order-3">
            <span
              className="hidden items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground sm:inline-flex"
              title="Team members online right now"
            >
              <span className="size-1.5 rounded-full bg-success" />
              {online} online
            </span>
            <NotificationBell />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{me?.full_name ?? "—"}</p>
              <RoleBadge role={me?.role ?? null} />
            </div>
            <Button variant="ghost" size="icon" onClick={() => void signOut()} aria-label="Sign out">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}
