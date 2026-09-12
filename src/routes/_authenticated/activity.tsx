import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ActivityFeed } from "@/components/ActivityFeed";
import { useMe } from "@/hooks/useMe";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Activity — Studio Ops" },
      { name: "description", content: "Live, role-filtered activity feed for the studio." },
      { property: "og:title", content: "Activity — Studio Ops" },
      {
        property: "og:description",
        content: "Live, role-filtered activity feed for the studio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const { data: me } = useMe();
  const role = me?.role ?? "developer";

  return (
    <AppShell
      title="Activity"
      subtitle={
        role === "admin"
          ? "Every change across every project."
          : role === "project_manager"
            ? "Changes on the projects you own."
            : "Changes on the tasks assigned to you."
      }
    >
      <ActivityFeed limit={100} title="Activity history" className="max-w-3xl" />
    </AppShell>
  );
}
