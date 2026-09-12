import { createFileRoute } from "@tanstack/react-router";
import { seedDemoData } from "@/lib/seed.functions";

/**
 * Bootstrap endpoint for the demo dataset.
 * Open only while the database is empty; re-seeding requires SEED_SECRET.
 */
export const Route = createFileRoute("/api/public/seed")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { secret?: string; force?: boolean } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          body = {};
        }
        try {
          const result = await seedDemoData({ data: body });
          return Response.json(result);
        } catch (error) {
          console.error("[seed route]", error);
          return Response.json(
            { error: { code: "SEED_FAILED", message: "Seeding failed." } },
            { status: 400 },
          );
        }
      },
    },
  },
});
