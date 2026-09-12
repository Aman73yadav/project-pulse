import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { apiError } from "./api-error";

/**
 * Real account creation for the team.
 *
 * The account is created server-side with the service role so the profile row
 * and the role grant are written in the same step (the roles table is never
 * writable from the browser). The first account ever created becomes the
 * admin; everyone after that starts as a developer and an admin can promote
 * them.
 */
export const signUpTeamMember = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        full_name: z.string().trim().min(2).max(120),
        email: z.string().trim().email().max(160),
        password: z.string().min(8).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (t: string) => any };

    const email = data.email.toLowerCase();

    const { count: adminCount } = await db
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    const role = (adminCount ?? 0) === 0 ? "admin" : "developer";

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });

    if (error || !created.user) {
      const message = error?.message ?? "";
      if (/already/i.test(message)) {
        throw apiError("CONFLICT", "An account with that email already exists.");
      }
      console.error("[signup]", error);
      throw apiError("INTERNAL_ERROR", "The account could not be created.");
    }

    await db
      .from("profiles")
      .upsert({ id: created.user.id, full_name: data.full_name, email }, { onConflict: "id" });
    await db
      .from("user_roles")
      .upsert({ user_id: created.user.id, role }, { onConflict: "user_id,role" });

    return { id: created.user.id, role };
  });
