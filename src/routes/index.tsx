import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Radio, ListChecks } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Studio Ops — Agency Project Dashboard" },
      {
        name: "description",
        content:
          "Internal agency dashboard for client projects, task progress and a live, role-filtered activity feed.",
      },
      { property: "og:title", content: "Studio Ops — Agency Project Dashboard" },
      {
        property: "og:description",
        content:
          "Internal agency dashboard for client projects, task progress and a live, role-filtered activity feed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const POINTS = [
  {
    icon: ShieldCheck,
    title: "Three access levels",
    body: "Admin, project manager and developer. The rules are enforced in the database, so a modified token still sees nothing extra.",
  },
  {
    icon: Radio,
    title: "Live activity feed",
    body: "Task moves stream to everyone viewing a project over a WebSocket, and the last 20 events are re-read from the database after a reconnect.",
  },
  {
    icon: ListChecks,
    title: "Shareable filters",
    body: "Status, priority and due-date filters live in the address bar, so a filtered task list is just a link.",
  },
];

function Landing() {
  return (
    <main className="min-h-screen bg-secondary/50">
      <div className="mx-auto max-w-5xl px-4 py-20">
        <p className="text-sm font-medium uppercase tracking-widest text-primary">Studio Ops</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
          Client projects, task progress and team activity — in one live view.
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          An internal dashboard for a small agency. What each person can see depends on their role.
        </p>
        <Link
          to="/auth"
          className="mt-8 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Sign in
        </Link>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {POINTS.map((point) => (
            <div key={point.title} className="rounded-lg border border-border bg-card p-5">
              <point.icon className="size-5 text-primary" />
              <h2 className="mt-3 font-medium">{point.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{point.body}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
