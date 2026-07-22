import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreateTeamInput = z.object({
  name: z.string().trim().min(1).max(80),
});

export const createTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => CreateTeamInput.parse(value))
  .handler(async ({ context, data }) => {
    const { data: team, error } = await context.supabase
      .from("teams")
      .insert({ name: data.name, created_by: context.userId })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return team;
  });