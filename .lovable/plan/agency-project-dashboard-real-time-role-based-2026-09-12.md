# Agency Project Dashboard — Real-Time, Role-Based

An internal tool for a small agency: manage clients and projects, track tasks, and watch team activity update live. Light, clean, professional look.

## Stack note (important)

The assessment asks for Express + Prisma + Socket.io on Vercel. This environment runs React + TypeScript on TanStack Start with a built-in Postgres database, a real WebSocket realtime layer, and server-side functions. I'll build the closest faithful equivalent — every requirement is met, with the substitutions documented in the README:

| Brief | Built as |
| --- | --- |
| Express/Fastify API | TanStack Start server functions + HTTP API routes (same request/response, validation, error shape) |
| JWT access + refresh, refresh in HttpOnly cookie | Built-in auth issues JWT access + refresh tokens; refresh token held in an HttpOnly cookie |
| Socket.io | Postgres realtime over WebSocket (true WebSocket, no polling, no SSE) |
| node-cron / Bull | Database scheduled job (pg_cron) running every 5 minutes |
| Prisma | SQL migrations + typed generated client, all queries in a data layer — never inline in UI |

## Roles and access

Three roles stored in a dedicated roles table (never on the user record):

- **Admin** — everything: clients, projects, users, global activity.
- **Project Manager** — creates and manages only their own projects; sees only their projects' tasks and activity.
- **Developer** — sees only tasks assigned to them; can change status; cannot see other developers' tasks.

Enforcement is at the database and API layer, not the UI. Every table has row-level security policies keyed to the caller's verified identity and role, so a modified token or a direct API call returns nothing extra. UI hiding is cosmetic only.

## Data model

- `clients` — name, contact, notes
- `projects` — client, name, description, created_by (PM/Admin), status
- `tasks` — project, title, description, assignee, status (To Do / In Progress / In Review / Done), priority (Low / Medium / High / Critical), due date, is_overdue
- `task_activity` — task, project, actor, action, from_status, to_status, timestamp (stored, never derived)
- `notifications` — recipient, type, task, message, read_at
- `profiles` / `user_roles` — display name, role
- `presence` — live online count via realtime presence (not a table)

Indexes on: tasks(project_id), tasks(assignee_id), tasks(status), tasks(priority), tasks(due_date), task_activity(project_id, created_at desc), task_activity(task_id), notifications(recipient_id, read_at). Rationale documented in the README.

## Screens

1. **Sign in** — email + password, seeded demo accounts listed for one-click login.
2. **Admin dashboard** — total projects, tasks by status, overdue count, live online-user count, global activity feed.
3. **PM dashboard** — own projects summary, tasks by priority, due this week, feed scoped to own projects.
4. **Developer dashboard** — assigned tasks sorted by priority then due date, feed scoped to own tasks.
5. **Projects list + project detail** — task board/table, create and edit tasks, per-task activity log.
6. **Clients** (Admin) and **Users** (Admin) management.
7. **Activity feed panel** — "Ravi moved Task #12 from In Progress → In Review · 2 mins ago". On load it fetches the last 20 events from the database (missed-event catchup), then streams new ones live.
8. **Notification bell** — unread count badge updating live over WebSocket, dropdown, mark one or all read.

## Filters

Status, priority, and due-date range on every task list, driven by URL query parameters so a filtered view is shareable. Filtering happens server-side.

## Overdue job

A scheduled database job runs every 5 minutes, flags tasks past their due date that aren't Done, and writes an activity entry. Never computed on page load.

## Notifications rules

- Task assigned → notification to the developer.
- Task moved to In Review → notification to the project's PM.

## Seed data

A seed migration inserts: 1 Admin, 2 PMs, 4 Developers (confirmed logins), 3 clients, 3 projects with 5+ tasks each across all statuses, 2 already-overdue tasks, and a batch of prior activity entries so the feed is populated on first load.

## Technical details

- All inputs validated server-side with Zod inside server functions; consistent `{ error: { code, message } }` responses, no stack traces leaked.
- No secrets in code; all keys come from environment/secret storage.
- Data access lives in a typed data layer (`src/lib/*.functions.ts` + `.server.ts`), separate from components.
- Realtime: Postgres change streams over WebSocket for activity, tasks, and notifications; presence channel for the live online count. Role filtering is applied by row-level security on the replicated rows, so a subscriber physically cannot receive rows they aren't allowed to see — the key design decision, explained in the README.
- README covers setup, schema description, indexing rationale, realtime/job/token decisions, and known limitations.

## Not included

Hosting on Vercel and pushing to a public GitHub repo are steps you do yourself — this app deploys through Lovable's own publish, and the repo can be connected to GitHub from project settings.
