import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { ScreenHeader, RecipeThumb, relativeTime } from "@/components/ui-bits";

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
      const { data, error } = await supabase
        .from("recipe_shares")
        .select(
          "created_at,recipes(id,title,description,image_url,created_at),profiles!recipe_shares_shared_by_fkey(display_name)",
        )
        .eq("shared_with", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const list =
    tab === "mine"
      ? mine.data?.map((r) => ({ ...r, sharer: null as string | null }))
      : shared.data?.map((s: any) => ({
          id: s.recipes?.id,
          title: s.recipes?.title,
          description: s.recipes?.description,
          image_url: s.recipes?.image_url,
          created_at: s.created_at,
          sharer: s.profiles?.display_name as string | null,
        }));

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
                <p className="text-[11px] text-ink/50 mt-0.5">
                  {r.sharer ? `From ${r.sharer}` : relativeTime(r.created_at)}
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
