import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.union([
  z.object({ imageData: z.string().min(20) }),
  z.object({ text: z.string().min(20) }),
]);

const RecipeSchema = z.object({
  title: z.string(),
  description: z.string().nullable().optional(),
  ingredients: z.string(),
  instructions: z.string(),
  prep_time: z.string().nullable().optional(),
  servings: z.string().nullable().optional(),
});

export type ScannedRecipe = z.infer<typeof RecipeSchema>;

const SYSTEM = `You are a recipe extraction assistant. Given a photo of a recipe (in any language) or pasted text/URL content, extract a clean, structured recipe. Preserve the original language of the recipe.
Return ONLY valid JSON matching this shape:
{
  "title": string,
  "description": string,
  "ingredients": string (one ingredient per line),
  "instructions": string (numbered steps, one per line),
  "prep_time": string,
  "servings": string
}
If a field is unknown, use an empty string. Never wrap the JSON in markdown fences.`;

export const scanRecipe = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => InputSchema.parse(v))
  .handler(async ({ data }): Promise<ScannedRecipe> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const content: Array<Record<string, unknown>> = [];
    if ("imageData" in data) {
      content.push({
        type: "text",
        text: "Extract the recipe visible in this photo and return the required JSON.",
      });
      content.push({ type: "image_url", image_url: { url: data.imageData } });
    } else {
      content.push({
        type: "text",
        text: `Extract a recipe from this text (may be a pasted recipe, URL, or notes) and return the required JSON:\n\n${data.text}`,
      });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("AI gateway error", res.status, body);
      if (res.status === 429) throw new Error("Too many requests. Try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Check your workspace billing.");
      throw new Error(`AI request failed (${res.status})`);
    }

    const json = await res.json();
    const raw = json?.choices?.[0]?.message?.content;
    if (!raw) throw new Error("AI returned no content");

    let parsed: unknown;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      throw new Error("AI returned invalid JSON");
    }
    return RecipeSchema.parse(parsed);
  });
