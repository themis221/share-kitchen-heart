import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { ScreenHeader, RecipeThumb, relativeTime } from "@/components/ui-bits";
import { Users } from "lucide-react";

const searchSchema = z.object({
  tab: z.enum(["mine", "shared"]).optional().default("mine"),
});

export const Route = createFileRoute("/_authenticated/recipes")({
  validateSearch: (s) => searchSchema.parse(s),
  component: RecipesScreen,
});

function RecipesScreen() {
  const { user } = Route.useRouteContext();
  const { tab } = Route.useSearch();

  const mine = useQuery({
    queryKey: ["recipes", "mine", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("id,title,description,created_at,image_url")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const shared = useQuery({
    queryKey: ["recipes", "shared-list", user.id],
    queryFn: async () => {
      const { data: recipes, error } = await supabase
        .from("recipes")
        .select("id,title,description,image_url,created_at,owner_id")
        .neq("owner_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!recipes?.length) return [];
      const ownerIds = Array.from(new Set(recipes.map((r) => r.owner_id)));
      const [{ data: profs }, { data: ts }] = await Promise.all([
        supabase.from("profiles").select("id,display_name").in("id", ownerIds),
        supabase
          .from("recipe_team_shares")
          .select("recipe_id,team_id")
          .in("recipe_id", recipes.map((r) => r.id)),
      ]);
      const teamIds = Array.from(new Set((ts ?? []).map((t) => t.team_id)));
      const teamNames = new Map<string, string>();
      if (teamIds.length) {
        const { data: teams } = await supabase
          .from("teams")
          .select("id,name")
          .in("id", teamIds);
        (teams ?? []).forEach((t) => teamNames.set(t.id, t.name));
      }
      const teamByRecipe = new Map<string, string>();
      (ts ?? []).forEach((row) => {
        if (!teamByRecipe.has(row.recipe_id)) {
          const name = teamNames.get(row.team_id);
          if (name) teamByRecipe.set(row.recipe_id, name);
        }
      });
      return recipes.map((r) => ({
        ...r,
        sharer: profs?.find((p) => p.id === r.owner_id)?.display_name ?? null,
        teamName: teamByRecipe.get(r.id) ?? null,
      }));
    },
  });

  const list =
    tab === "mine"
      ? mine.data?.map((r) => ({ ...r, sharer: null as string | null, teamName: null as string | null }))
      : shared.data;

  return (
    <div>
      <ScreenHeader eyebrow="Library" title="Recipes" />

      <div className="px-6 mb-6">
        <div className="inline-flex bg-creme rounded-full p-1 ring-1 ring-black/5">
          <TabLink label="My recipes" active={tab === "mine"} search={{ tab: "mine" }} />
          <TabLink label="Shared with me" active={tab === "shared"} search={{ tab: "shared" }} />
        </div>
      </div>

      <div className="px-6">
        {list && list.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {list.map((r: any) => (
              <Link
                key={r.id}
                to="/recipe/$id"
                params={{ id: r.id }}
                className="block"
              >
                <div className="aspect-[4/5] mb-2">
                  <RecipeThumb title={r.title ?? "?"} />
                </div>
                <h3 className="font-serif text-base leading-tight text-balance line-clamp-2">
                  {r.title}
                </h3>
                <p className="text-[11px] text-ink/50 mt-0.5 flex items-center gap-1">
                  {r.sharer ? `From ${r.sharer}` : relativeTime(r.created_at)}
                  {r.teamName && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-moss/15 text-moss text-[9px] font-medium">
                      <Users size={8} strokeWidth={2} /> {r.teamName}
                    </span>
                  )}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-[14px] bg-creme/60 ring-1 ring-black/5 p-8 text-center">
            <p className="font-serif text-lg mb-1">
              {tab === "mine" ? "Your library is empty" : "Nothing shared yet"}
            </p>
            <p className="text-sm text-ink/55 mb-4">
              {tab === "mine"
                ? "Add your first recipe to start your collection."
                : "Recipes friends share with you will appear here."}
            </p>
            {tab === "mine" && (
              <Link
                to="/add"
                className="inline-block rounded-full bg-clay px-5 py-2.5 text-sm font-medium text-paper"
              >
                Add a recipe
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TabLink({
  label,
  active,
  search,
}: {
  label: string;
  active: boolean;
  search: { tab: "mine" | "shared" };
}) {
  return (
    <Link
      to="/recipes"
      search={search}
      className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
        active ? "bg-ink text-paper" : "text-ink/60"
      }`}
    >
      {label}
    </Link>
  );
}
