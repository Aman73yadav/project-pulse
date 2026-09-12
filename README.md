# Studio Ops — Agency Project Dashboard

An internal project-management dashboard for a small agency. It supports three roles (Admin, Project Manager, Developer), live team activity via WebSocket, DB-backed notifications, and shareable URL filters.

## Features

- **Role-based access**: Admin sees everything; Project Managers own and manage their projects; Developers see and update only their assigned tasks.
- **Project & task management**: create clients, projects, and tasks; assign developers; set priority, due date, and status.
- **Live activity feed**: status changes are broadcast in real time and persisted in the database. Offline users receive the last 20 missed events on reconnect.
- **Notifications**: in-app notifications for task assignments and tasks moved to *In Review*, with unread badge and mark-read.
- **Overdue flagging**: a scheduled database job flags overdue tasks every hour.
- **Shareable filters**: task lists can be filtered by status, priority, and due-date range through query parameters.
- **Accounts**: real sign-up and email password reset. The first account created becomes the Admin; later sign-ups start as Developer. Any signed-in account without a profile/role row is repaired on first load, so a dashboard never renders "No role".
- **Task discussion & files**: every task has a detail page (`/task/:id`) with comments and private file attachments (8 MB per file). Files live in a private bucket; downloads are served through short-lived signed URLs issued only after the server re-checks visibility, so no storage object is publicly reachable.
- **Approval flow**: a Developer may move a task To Do → In Progress → In Review and back, but only an Admin or Project Manager can mark it *Done*. This is enforced by the `guard_task_update()` database trigger, not by the UI — the UI only hides options the database would reject.

## Tech stack

- **Framework**: React 19 + TanStack Start + TanStack Router
- **Realtime**: Supabase Realtime (WebSocket)
- **Database**: PostgreSQL (managed via Supabase)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **Validation**: Zod

## Prerequisites

- Node.js 20+ and a package manager (Bun recommended; npm works too)
- A Supabase project
- `pg_cron` and `pg_net` extensions enabled in Supabase

## Environment variables

Create a `.env` file at the project root with at least these keys:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-anon-key
SUPABASE_PROJECT_ID=your-project-id
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id

# Required for seeding and demo sign-in
DEMO_ACCOUNT_PASSWORD=a-strong-demo-password
SEED_SECRET=a-long-random-secret-for-reseeding
```

The Supabase service-role key is read inside server functions through the managed runtime and is not stored in the frontend bundle.

## Setup

1. Install dependencies:

```sh
bun install
```

2. Apply the migrations in `supabase/migrations/` to your Supabase database in order.

3. Schedule the overdue task sweeper once in Supabase SQL Editor:

```sql
SELECT cron.schedule('flag-overdue-tasks', '0 * * * *', 'SELECT public.flag_overdue_tasks();');
```

4. Start the dev server:

```sh
bun run dev
```

The app runs on `http://localhost:8080` by default.

## Seeding demo data

Visit `/api/public/seed` with a `POST` request. On a fresh, empty database the seed runs without a secret. To re-seed an existing database, send:

```json
{ "secret": "your-SEED_SECRET", "force": true }
```

## Demo accounts

| Email | Role | Password |
|-------|------|----------|
| `admin@velozity.test` | Admin | configured by `DEMO_ACCOUNT_PASSWORD` |
| `pm1@velozity.test` | Project Manager | configured by `DEMO_ACCOUNT_PASSWORD` |
| `pm2@velozity.test` | Project Manager | configured by `DEMO_ACCOUNT_PASSWORD` |
| `dev1@velozity.test` | Developer | configured by `DEMO_ACCOUNT_PASSWORD` |
| `dev2@velozity.test` | Developer | configured by `DEMO_ACCOUNT_PASSWORD` |
| `dev3@velozity.test` | Developer | configured by `DEMO_ACCOUNT_PASSWORD` |
| `dev4@velozity.test` | Developer | configured by `DEMO_ACCOUNT_PASSWORD` |

The sign-in page has buttons that pre-fill the demo credentials using the server-provided demo password.

## Database schema

Key tables:

- `profiles` / `user_roles` — user identity and role assignment
- `clients` — agency clients
- `projects` — client projects, owned by the creating PM
- `tasks` — project tasks with status, priority, assignee, due date, and overdue flag
- `task_activity` — immutable history of status changes, assignments, and overdue flags
- `notifications` — per-user in-app notifications

Enums:

- `app_role`: `admin`, `project_manager`, `developer`
- `task_status`: `todo`, `in_progress`, `in_review`, `done`
- `task_priority`: `low`, `medium`, `high`, `critical`

Indexes cover the most queried paths: `projects.created_by`, `tasks.project_id`, `tasks.assignee_id`, `tasks.status`, `tasks.priority`, `tasks.due_date`, `task_activity.project_id + created_at`, and `notifications.recipient_id + read_at`.

Row-Level Security (RLS) policies enforce the role model at the database layer; frontend hiding is not relied on for access control.

## Architecture decisions

- **TanStack Start instead of Express/Fastify**: server functions and public API routes provide request/response semantics similar to Express while remaining deployable on the edge.
- **Supabase Realtime over Socket.io**: realtime is delivered through PostgreSQL logical replication over a WebSocket. This avoids running a separate stateful Node server and lets the database be the single source of truth for live events.
- **Database triggers for activity/notifications**: every task insert and update is recorded by PostgreSQL triggers. This guarantees audit history even if a client skips a request.
- **pg_cron for overdue flagging**: a scheduled SQL function runs hourly to set `is_overdue`. The flag is persisted so dashboards and filters do not compute overdue state on every page load.
- **RLS helpers as SECURITY DEFINER functions**: recursive policy checks are avoided by delegating role checks to owner-rights helper functions.

## Known limitations

- The seed endpoint requires a service-role key and should be disabled or removed in production.
- Realtime presence counts online users only when at least one authenticated client is subscribed to the shared presence channel.
- File uploads and email notifications are not implemented.

## Reflection: the hardest problem

The real-time, role-filtered activity feed was the hardest part. Every status change must be visible to the right people, in the right scope, without leaking data. Admins need a global feed, Project Managers only their own projects, and Developers only tasks assigned to them. We solved this by making PostgreSQL both the event source and the authorization layer: the same RLS policies that protect reads also filter the historical query used for missed events, and Supabase Realtime pushes live changes to subscribed clients. The client then refetches its permitted activity window rather than trusting broadcast payloads for visibility. This keeps the feed consistent after reconnects or browser tabs coming back online, because the database—not an in-memory cache—is the source of truth. If I did it again, I would extract a dedicated event-sink table (`events`) with a stable ordering key and materialized per-role views, so the feed query stays O(1) for large histories instead of scanning `task_activity` with RLS predicates on every reconnect.