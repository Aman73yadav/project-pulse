import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { apiError } from "./api-error";

/**
 * Seed script.
 *
 * Creates 1 admin, 2 project managers, 4 developers, 3 clients, 3 projects with
 * 5+ tasks each (across every status, two already overdue) and pre-existing
 * activity entries so the live feed is not empty on first load.
 *
 * Idempotent: it refuses to run twice unless `force` is set.
 */

/**
 * Demo password. Prefer the environment value; fall back to the shared demo
 * password so the public demo works on hosts without env configuration.
 * This is throwaway seed-data credential material, not a real secret.
 */
export const DEFAULT_DEMO_PASSWORD = "Velozity#Demo2026";

function demoPassword(): string {
  return process.env["DEMO_ACCOUNT_PASSWORD"] || DEFAULT_DEMO_PASSWORD;
}

/** Public: lets the sign-in page fill the demo credentials for this internal tool. */
export const getDemoPassword = createServerFn({ method: "GET" }).handler(async () => ({
  password: demoPassword(),
}));

interface SeedPerson {
  email: string;
  name: string;
  role: "admin" | "project_manager" | "developer";
}

const PEOPLE: SeedPerson[] = [
  { email: "admin@velozity.test", name: "Asha Menon", role: "admin" },
  { email: "pm1@velozity.test", name: "Priya Nair", role: "project_manager" },
  { email: "pm2@velozity.test", name: "Marcus Feld", role: "project_manager" },
  { email: "dev1@velozity.test", name: "Ravi Kumar", role: "developer" },
  { email: "dev2@velozity.test", name: "Lena Roth", role: "developer" },
  { email: "dev3@velozity.test", name: "Tom Adeyemi", role: "developer" },
  { email: "dev4@velozity.test", name: "Sara Iqbal", role: "developer" },
];

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export const seedDemoData = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ secret: z.string().optional(), force: z.boolean().default(false) })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (t: string) => any };

    const { count } = await db.from("projects").select("id", { count: "exact", head: true });
    const isEmpty = (count ?? 0) === 0;

    // First-run bootstrap is open; re-seeding an already populated database
    // requires the SEED_SECRET from the environment.
    if (!isEmpty) {
      const expected = process.env["SEED_SECRET"];
      if (!expected || data.secret !== expected) {
        throw apiError("FORBIDDEN", "Invalid seed secret.");
      }
      if (!data.force) {
        return { skipped: true as const, message: "Data already seeded." };
      }
    }

    /* ---------- users ---------- */
    const ids = new Map<string, string>();
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    for (const person of PEOPLE) {
      const existing = existingUsers?.users.find((u) => u.email === person.email);
      if (existing) {
        ids.set(person.email, existing.id);
        await supabaseAdmin.auth.admin.updateUserById(existing.id, { password: demoPassword() });
      } else {
        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email: person.email,
          password: demoPassword(),
          email_confirm: true,
          user_metadata: { full_name: person.name },
        });
        if (error || !created.user) {
          console.error("[seed] user create failed", error);
          throw apiError("INTERNAL_ERROR", `Could not create ${person.email}.`);
        }
        ids.set(person.email, created.user.id);
      }
    }

    await db.from("profiles").upsert(
      PEOPLE.map((p) => ({ id: ids.get(p.email)!, full_name: p.name, email: p.email })),
      { onConflict: "id" },
    );
    await db.from("user_roles").upsert(
      PEOPLE.map((p) => ({ user_id: ids.get(p.email)!, role: p.role })),
      { onConflict: "user_id,role" },
    );

    const admin = ids.get("admin@velozity.test")!;
    const pm1 = ids.get("pm1@velozity.test")!;
    const pm2 = ids.get("pm2@velozity.test")!;
    const dev1 = ids.get("dev1@velozity.test")!;
    const dev2 = ids.get("dev2@velozity.test")!;
    const dev3 = ids.get("dev3@velozity.test")!;
    const dev4 = ids.get("dev4@velozity.test")!;

    /* ---------- reset previous demo content ---------- */
    if (data.force) {
      await db.from("notifications").delete().not("id", "is", null);
      await db.from("task_activity").delete().not("id", "is", null);
      await db.from("tasks").delete().not("id", "is", null);
      await db.from("projects").delete().not("id", "is", null);
      await db.from("clients").delete().not("id", "is", null);
    }

    /* ---------- clients ---------- */
    const { data: clients, error: clientError } = await db
      .from("clients")
      .insert([
        { name: "Northwind Retail", contact_email: "ops@northwind.test", notes: "Ecommerce replatform" },
        { name: "Harbour Health", contact_email: "it@harbourhealth.test", notes: "Patient portal" },
        { name: "Lumen Studio", contact_email: "hello@lumen.test", notes: "Brand site + CMS" },
      ])
      .select("id, name");
    if (clientError) {
      console.error("[seed] clients", clientError);
      throw apiError("INTERNAL_ERROR", "Could not create clients.");
    }
    const clientId = (name: string) =>
      clients.find((c: { name: string }) => c.name === name)?.id as string;

    /* ---------- projects ---------- */
    const { data: projects, error: projectError } = await db
      .from("projects")
      .insert([
        {
          name: "Northwind Storefront Rebuild",
          description: "Headless storefront, checkout revamp and search.",
          client_id: clientId("Northwind Retail"),
          created_by: pm1,
        },
        {
          name: "Harbour Patient Portal",
          description: "Appointments, records and secure messaging.",
          client_id: clientId("Harbour Health"),
          created_by: pm1,
        },
        {
          name: "Lumen Brand Site",
          description: "Marketing site with editorial CMS.",
          client_id: clientId("Lumen Studio"),
          created_by: pm2,
        },
      ])
      .select("id, name");
    if (projectError) {
      console.error("[seed] projects", projectError);
      throw apiError("INTERNAL_ERROR", "Could not create projects.");
    }
    const projectId = (name: string) =>
      projects.find((p: { name: string }) => p.name === name)?.id as string;

    const storefront = projectId("Northwind Storefront Rebuild");
    const portal = projectId("Harbour Patient Portal");
    const brand = projectId("Lumen Brand Site");

    /* ---------- tasks ---------- */
    const taskRows = [
      // Northwind (PM: Priya)
      { project_id: storefront, title: "Product listing page performance", description: "Cut LCP below 2s on category pages.", assignee_id: dev1, status: "in_progress", priority: "high", due_date: daysFromNow(4), created_by: pm1 },
      { project_id: storefront, title: "Checkout payment retry flow", description: "Handle declined cards without losing the cart.", assignee_id: dev2, status: "in_review", priority: "critical", due_date: daysFromNow(2), created_by: pm1 },
      { project_id: storefront, title: "Migrate legacy product images", description: "Batch import and resize 40k assets.", assignee_id: dev1, status: "todo", priority: "medium", due_date: daysFromNow(9), created_by: pm1 },
      { project_id: storefront, title: "Search relevance tuning", description: "Synonyms and typo tolerance for the catalogue.", assignee_id: dev3, status: "todo", priority: "low", due_date: daysFromNow(14), created_by: pm1 },
      { project_id: storefront, title: "Analytics event contract", description: "Agree tracking schema with the client.", assignee_id: dev2, status: "done", priority: "medium", due_date: daysFromNow(-6), created_by: pm1 },
      // overdue #1
      { project_id: storefront, title: "Gift card redemption bug", description: "Codes rejected at checkout for partial amounts.", assignee_id: dev1, status: "in_progress", priority: "critical", due_date: daysFromNow(-3), created_by: pm1 },

      // Harbour (PM: Priya)
      { project_id: portal, title: "Appointment booking calendar", description: "Slot availability with timezone handling.", assignee_id: dev3, status: "in_progress", priority: "high", due_date: daysFromNow(6), created_by: pm1 },
      { project_id: portal, title: "Secure messaging thread view", description: "Clinician and patient threads with attachments.", assignee_id: dev4, status: "todo", priority: "high", due_date: daysFromNow(11), created_by: pm1 },
      { project_id: portal, title: "Records export to PDF", description: "Downloadable visit summaries.", assignee_id: dev4, status: "in_review", priority: "medium", due_date: daysFromNow(3), created_by: pm1 },
      { project_id: portal, title: "Accessibility audit fixes", description: "WCAG 2.2 AA remediation pass.", assignee_id: dev3, status: "todo", priority: "medium", due_date: daysFromNow(18), created_by: pm1 },
      { project_id: portal, title: "Session timeout policy", description: "15 minute idle logout with warning.", assignee_id: dev2, status: "done", priority: "low", due_date: daysFromNow(-12), created_by: pm1 },
      // overdue #2
      { project_id: portal, title: "Consent form versioning", description: "Track which consent version a patient signed.", assignee_id: dev4, status: "todo", priority: "high", due_date: daysFromNow(-5), created_by: pm1 },

      // Lumen (PM: Marcus)
      { project_id: brand, title: "CMS content model", description: "Pages, articles and reusable blocks.", assignee_id: dev2, status: "in_progress", priority: "high", due_date: daysFromNow(5), created_by: pm2 },
      { project_id: brand, title: "Homepage art direction build", description: "Full-bleed editorial hero and case grid.", assignee_id: dev3, status: "todo", priority: "critical", due_date: daysFromNow(7), created_by: pm2 },
      { project_id: brand, title: "Case study template", description: "Flexible layout for studio work.", assignee_id: dev4, status: "in_review", priority: "medium", due_date: daysFromNow(4), created_by: pm2 },
      { project_id: brand, title: "Newsletter signup integration", description: "Double opt-in with the client's ESP.", assignee_id: dev1, status: "todo", priority: "low", due_date: daysFromNow(16), created_by: pm2 },
      { project_id: brand, title: "SEO metadata pass", description: "Titles, descriptions and structured data.", assignee_id: dev2, status: "done", priority: "medium", due_date: daysFromNow(-9), created_by: pm2 },
    ];

    const { data: tasks, error: taskError } = await db
      .from("tasks")
      .insert(taskRows)
      .select("id, title, task_number, project_id, assignee_id");
    if (taskError) {
      console.error("[seed] tasks", taskError);
      throw apiError("INTERNAL_ERROR", "Could not create tasks.");
    }

    // flag the two intentionally overdue tasks
    await db.from("tasks").update({ is_overdue: true }).lt("due_date", new Date().toISOString()).neq("status", "done");

    /* ---------- pre-existing activity so the feed is populated ---------- */
    const byTitle = (title: string) =>
      tasks.find((t: { title: string }) => t.title === title) as
        | { id: string; project_id: string }
        | undefined;

    const history = [
      { title: "Checkout payment retry flow", actor: dev2, from: "in_progress", to: "in_review", minutes: 4 },
      { title: "Product listing page performance", actor: dev1, from: "todo", to: "in_progress", minutes: 26 },
      { title: "Records export to PDF", actor: dev4, from: "in_progress", to: "in_review", minutes: 55 },
      { title: "Gift card redemption bug", actor: dev1, from: "todo", to: "in_progress", minutes: 120 },
      { title: "Analytics event contract", actor: dev2, from: "in_review", to: "done", minutes: 300 },
      { title: "CMS content model", actor: dev2, from: "todo", to: "in_progress", minutes: 420 },
      { title: "Case study template", actor: dev4, from: "in_progress", to: "in_review", minutes: 610 },
      { title: "Session timeout policy", actor: dev2, from: "in_review", to: "done", minutes: 900 },
      { title: "SEO metadata pass", actor: dev2, from: "in_review", to: "done", minutes: 1500 },
      { title: "Appointment booking calendar", actor: dev3, from: "todo", to: "in_progress", minutes: 1800 },
    ];

    const activityRows = history.flatMap((h) => {
      const task = byTitle(h.title);
      if (!task) return [];
      return [
        {
          task_id: task.id,
          project_id: task.project_id,
          actor_id: h.actor,
          action: "status_changed",
          from_status: h.from,
          to_status: h.to,
          detail: h.title,
          created_at: new Date(Date.now() - h.minutes * 60 * 1000).toISOString(),
        },
      ];
    });
    await db.from("task_activity").insert(activityRows);

    /* ---------- a couple of unread notifications ---------- */
    const review = byTitle("Checkout payment retry flow");
    const assigned = byTitle("Consent form versioning");
    const notifications = [];
    if (review) {
      notifications.push({
        recipient_id: pm1,
        type: "task_in_review",
        task_id: review.id,
        project_id: review.project_id,
        message: "Checkout payment retry flow is ready for review",
      });
    }
    if (assigned) {
      notifications.push({
        recipient_id: dev4,
        type: "task_assigned",
        task_id: assigned.id,
        project_id: assigned.project_id,
        message: "You were assigned: Consent form versioning",
      });
    }
    if (notifications.length) await db.from("notifications").insert(notifications);

    return {
      skipped: false as const,
      admin,
      users: PEOPLE.length,
      projects: projects.length,
      tasks: tasks.length,
      activity: activityRows.length,
    };
  });
