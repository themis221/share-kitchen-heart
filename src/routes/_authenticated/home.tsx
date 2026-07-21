import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScreenHeader, Avatar, RecipeThumb, relativeTime } from "@/components/ui-bits";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomeScreen,
});

async function fetchSharedFeed(userId: string, limit: number) {
  // Any recipe I can see that isn't mine (RLS covers person + team shares)
  const { data: recipes, error } = await supabase
    .from("recipes")
    .select("id,title,description,image_url,created_at,owner_id")
    .neq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!recipes?.length) return [];

  const recipeIds = recipes.map((r) => r.id);
  const ownerIds = Array.from(new Set(recipes.map((r) => r.owner_id)));

  const [ownersRes, teamSharesRes] = await Promise.all([
    supabase.from("profiles").select("id,display_name,avatar_url").in("id", ownerIds),
    supabase
      .from("recipe_team_shares")
      .select("recipe_id,team_id")
      .in("recipe_id", recipeIds),
  ]);

  const owners = new Map((ownersRes.data ?? []).map((p) => [p.id, p]));
  const teamShareByRecipe = new Map<string, string[]>();
  (teamSharesRes.data ?? []).forEach((ts) => {
    const arr = teamShareByRecipe.get(ts.recipe_id) ?? [];
    arr.push(ts.team_id);
    teamShareByRecipe.set(ts.recipe_id, arr);
  });

  const teamIds = Array.from(
    new Set(Array.from(teamShareByRecipe.values()).flat()),
  );
  const teamNames = new Map<string, string>();
  if (teamIds.length) {
    const { data: teams } = await supabase.from("teams").select("id,name").in("id", teamIds);
    (teams ?? []).forEach((t) => teamNames.set(t.id, t.name));
  }

  return recipes.map((r) => {
    const ownerProfile = owners.get(r.owner_id) ?? null;
    const teamId = teamShareByRecipe.get(r.id)?.[0];
    return {
      ...r,
      owner: ownerProfile,
      teamName: teamId ? teamNames.get(teamId) ?? null : null,
    };
  });
}

function HomeScreen() {
  const { user } = Route.useRouteContext();

  const { data: myRecents } = useQuery({
    queryKey: ["recipes", "recent", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("id,title,description,created_at,image_url,owner_id")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  const { data: shared } = useQuery({
    queryKey: ["recipes", "shared", user.id],
    queryFn: () => fetchSharedFeed(user.id, 6),
  });

  const displayName =
    (user.user_metadata as any)?.name ??
    (user.user_metadata as any)?.full_name ??
    user.email?.split("@")[0] ??
    "there";

  return (
    <div>
      <ScreenHeader
        eyebrow={`Hello, ${displayName}`}
        title="The Kitchen Table"
        right={<Avatar name={displayName} className="size-9" />}
      />

      {/* Recents */}
      <section className="mb-8">
        <div className="px-6 mb-4 flex justify-between items-center">
          <h2 className="text-[11px] font-medium tracking-[0.2em] uppercase text-ink/60">
            Recents
          </h2>
          <Link to="/recipes" className="text-xs font-medium text-clay">
            View all
          </Link>
        </div>
        {myRecents && myRecents.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto px-6 no-scrollbar pb-1">
            {myRecents.map((r) => (
              <Link
                key={r.id}
                to="/recipe/$id"
                params={{ id: r.id }}
                className="flex-none w-56"
              >
                <div className="w-full aspect-[4/5] mb-3">
                  <RecipeThumb title={r.title} />
                </div>
                <h3 className="font-serif text-xl leading-tight text-balance mb-1 line-clamp-2">
                  {r.title}
                </h3>
                <p className="text-xs text-ink/55">Added {relativeTime(r.created_at)}</p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyBlock title="No recipes yet" cta="Add your first recipe" to="/add" />
        )}
      </section>

      {/* Shared with you */}
      <section className="px-6 mb-8">
        <h2 className="text-[11px] font-medium tracking-[0.2em] uppercase text-ink/60 mb-4">
          Shared with you
        </h2>
        {shared && shared.length > 0 ? (
          <div className="space-y-3">
            {shared.map((s) => (
              <Link
                key={s.id}
                to="/recipe/$id"
                params={{ id: s.id }}
                className="flex items-center p-3 bg-creme/60 rounded-[14px] ring-1 ring-black/5 gap-3"
              >
                <Avatar name={s.owner?.display_name ?? "Cook"} className="size-10 shrink-0" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-serif text-base leading-tight truncate">{s.title}</h4>
                  <p className="text-xs text-ink/55 truncate flex items-center gap-1.5">
                    From {s.owner?.display_name ?? "a friend"}
                    {s.teamName && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-moss/15 text-moss text-[10px] font-medium">
                        <Users size={9} strokeWidth={2} /> {s.teamName}
                      </span>
                    )}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-[14px] bg-creme/60 ring-1 ring-black/5 p-6 text-center">
            <p className="text-sm text-ink/60">
              Nothing shared with you yet. Recipes friends share with you land here.
            </p>
          </div>
        )}
      </section>

      {/* Quick add cta */}
      <section className="px-6 mb-6">
        <Link to="/add" className="block">
          <div className="bg-clay p-6 rounded-[22px] text-paper transition-transform active:scale-[0.98]">
            <h3 className="font-serif text-2xl leading-tight mb-4 text-balance">
              New inspiration?
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-paper/10 rounded-[12px] text-left">
                <p className="text-[10px] opacity-70 mb-1 uppercase tracking-widest">Quick</p>
                <p className="text-sm font-medium">Manual entry</p>
              </div>
              <div className="p-4 bg-paper/20 rounded-[12px] text-left">
                <p className="text-[10px] opacity-70 mb-1 uppercase tracking-widest">Magic</p>
                <p className="text-sm font-medium">Scan with AI</p>
              </div>
            </div>
          </div>
        </Link>
      </section>
    </div>
  );
}

function EmptyBlock({ title, cta, to }: { title: string; cta: string; to: string }) {
  return (
    <div className="mx-6 rounded-[14px] bg-creme/60 ring-1 ring-black/5 p-6 text-center">
      <p className="font-serif text-lg mb-1">{title}</p>
      <Link to={to} className="text-sm text-clay font-medium">
        {cta} →
      </Link>
    </div>
  );
}
