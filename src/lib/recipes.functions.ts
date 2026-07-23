import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreateRecipeInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().nullable().optional(),
  ingredients: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  prep_time: z.string().nullable().optional(),
  servings: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  source: z.enum(["manual", "ai_scan"]).default("manual"),
});

export const createRecipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => CreateRecipeInput.parse(v))
  .handler(async ({ context, data }) => {
    const id = crypto.randomUUID();
    const { error } = await context.supabase
      .from("recipes")
      .insert({ ...data, id, owner_id: context.userId });
    if (error) throw new Error(error.message);
    return { id };
  });
