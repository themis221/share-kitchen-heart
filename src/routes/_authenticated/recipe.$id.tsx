import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RecipeThumb, Avatar, relativeTime } from "@/components/ui-bits";
import { toast } from "sonner";
import { ArrowLeft, Share2, Trash2, Users, X, Clock, MessageCircle, Send, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/recipe/$id")({
  component: RecipeDetail,
});

function RecipeDetail() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showShare, setShowShare] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  const { data: recipe, isLoading } = useQuery({
    queryKey: ["recipe", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", data.owner_id)
        .maybeSingle();
      return { ...data, profiles: ownerProfile };
    },
  });

  const { data: sharedWith } = useQuery({
    queryKey: ["recipe-shares", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipe_shares")
        .select("id,shared_with")
        .eq("recipe_id", id);
      if (error) throw error;
      if (!data?.length) return [];
      const ids = data.map((s) => s.shared_with);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,display_name,email")
        .in("id", ids);
      return data.map((s) => ({
        ...s,
        profiles: profs?.find((p) => p.id === s.shared_with) ?? null,
      }));
    },
    enabled: !!recipe && recipe.owner_id === user.id,
  });

  const { data: teamShares } = useQuery({
    queryKey: ["recipe-team-shares", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipe_team_shares")
        .select("id,team_id")
        .eq("recipe_id", id);
      if (error) throw error;
      if (!data?.length) return [];
      const { data: ts } = await supabase
        .from("teams")
        .select("id,name")
        .in("id", data.map((s) => s.team_id));
      return data.map((s) => ({
        ...s,
        team: ts?.find((t) => t.id === s.team_id) ?? null,
      }));
    },
    enabled: !!recipe,
  });

  const { data: comments } = useQuery({
    queryKey: ["recipe-comments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipe_comments")
        .select("id,body,author_id,created_at")
        .eq("recipe_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (!data?.length) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,display_name")
        .in("id", Array.from(new Set(data.map((c) => c.author_id))));
      return data.map((c) => ({
        ...c,
        author: profs?.find((p) => p.id === c.author_id) ?? null,
      }));
    },
    enabled: !!recipe,
  });

  if (isLoading) {
    return <div className="p-8 text-center text-ink/50 text-sm">Loading…</div>;
  }
  if (!recipe) {
    return (
      <div className="p-8 text-center">
        <p className="text-ink/60">Recipe not found.</p>
        <button onClick={() => navigate({ to: "/home" })} className="mt-3 text-clay text-sm">
          Back home
        </button>
      </div>
    );
  }

  const isOwner = recipe.owner_id === user.id;

  async function handleDelete() {
    if (!confirm("Delete this recipe?")) return;
    const { error } = await supabase.from("recipes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    queryClient.invalidateQueries({ queryKey: ["recipes"] });
    navigate({ to: "/recipes" });
  }

  async function submitComment() {
    const body = commentBody.trim();
    if (!body) return;
    setSendingComment(true);
    const { error } = await supabase
      .from("recipe_comments")
      .insert({ recipe_id: id, author_id: user.id, body });
    setSendingComment(false);
    if (error) return toast.error(error.message);
    setCommentBody("");
    queryClient.invalidateQueries({ queryKey: ["recipe-comments", id] });
  }

  async function deleteComment(commentId: string) {
    const { error } = await supabase.from("recipe_comments").delete().eq("id", commentId);
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["recipe-comments", id] });
  }

  return (
    <div>
      <div className="pt-10 px-6 pb-4 flex items-center justify-between gap-3">
        <button
          onClick={() => navigate({ to: "/recipes" })}
          className="size-9 rounded-full bg-creme grid place-items-center ring-1 ring-black/5"
          aria-label="Back"
        >
          <ArrowLeft size={16} strokeWidth={1.75} />
        </button>
        <div className="flex gap-2">
          {isOwner && (
            <>
              <button
                onClick={() => setShowShare(true)}
                className="size-9 rounded-full bg-clay text-paper grid place-items-center"
                aria-label="Share"
              >
                <Share2 size={16} strokeWidth={1.75} />
              </button>
              <button
                onClick={handleDelete}
                className="size-9 rounded-full bg-creme grid place-items-center ring-1 ring-black/5 text-ink/60"
                aria-label="Delete"
              >
                <Trash2 size={16} strokeWidth={1.75} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="px-6">
        <div className="aspect-[4/3] mb-5 rounded-[22px] overflow-hidden">
          <RecipeThumb title={recipe.title} />
        </div>
        <h1 className="font-serif text-4xl leading-[1.05] text-balance mb-3">{recipe.title}</h1>
        {recipe.description && (
          <p className="text-ink/70 text-[15px] leading-relaxed mb-4">{recipe.description}</p>
        )}
        <div className="flex flex-wrap gap-2 mb-6">
          {recipe.prep_time && (
            <Chip icon={<Clock size={12} />}>{recipe.prep_time}</Chip>
          )}
          {recipe.servings && <Chip>{recipe.servings} servings</Chip>}
          {!isOwner && (recipe as any).profiles?.display_name && (
            <Chip>From {(recipe as any).profiles.display_name}</Chip>
          )}
          {recipe.source === "ai_scan" && <Chip>AI scanned</Chip>}
        </div>

        {recipe.ingredients && (
          <section className="mb-6">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink/60 mb-3">
              Ingredients
            </h2>
            <ul className="rounded-[16px] bg-creme/60 ring-1 ring-black/5 p-5 text-sm leading-relaxed space-y-2.5">
              {recipe.ingredients
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean)
                .map((line, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="mt-2 size-1.5 rounded-full bg-clay/70 shrink-0" />
                    <span>{line}</span>
                  </li>
                ))}
            </ul>
          </section>
        )}

        {recipe.instructions && (
          <section className="mb-8">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink/60 mb-3">
              Instructions
            </h2>
            <ol className="text-[15px] leading-relaxed text-ink/85 space-y-4">
              {recipe.instructions
                .split("\n")
                .map((l) => l.replace(/^\s*\d+[\.\)]\s*/, "").trim())
                .filter(Boolean)
                .map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="font-serif text-clay text-lg leading-none pt-0.5 shrink-0 w-6">
                      {i + 1}.
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
            </ol>
          </section>
        )}

        {isOwner && (
          <>
            {sharedWith && sharedWith.length > 0 && (
              <section className="mb-6">
                <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink/60 mb-3 flex items-center gap-1.5">
                  <Users size={12} /> Shared with
                </h2>
                <div className="space-y-2">
                  {sharedWith.map((s: any) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 p-2.5 rounded-[12px] bg-creme/60"
                    >
                      <Avatar name={s.profiles?.display_name} className="size-8" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{s.profiles?.display_name}</p>
                        <p className="text-[11px] text-ink/50 truncate">{s.profiles?.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {teamShares && teamShares.length > 0 && (
              <section className="mb-6">
                <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink/60 mb-3 flex items-center gap-1.5">
                  <Users size={12} /> Shared to teams
                </h2>
                <div className="flex flex-wrap gap-2">
                  {teamShares.map((s: any) => (
                    <span key={s.id} className="px-3 py-1.5 rounded-full bg-moss/15 text-moss text-xs font-medium">
                      {s.team?.name}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* Comments */}
        <section className="mb-8">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink/60 mb-3 flex items-center gap-1.5">
            <MessageCircle size={12} /> Comments
          </h2>
          <div className="space-y-3 mb-3">
            {comments && comments.length > 0 ? (
              comments.map((c: any) => (
                <div key={c.id} className="flex gap-3">
                  <Avatar name={c.author?.display_name ?? "Cook"} className="size-8 shrink-0" />
                  <div className="flex-1 min-w-0 rounded-[14px] bg-creme/60 ring-1 ring-black/5 px-3.5 py-2.5">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-xs font-medium truncate">
                        {c.author?.display_name ?? "Cook"}
                      </p>
                      <p className="text-[10px] text-ink/40">{relativeTime(c.created_at)}</p>
                    </div>
                    <p className="text-sm text-ink/85 whitespace-pre-wrap break-words">{c.body}</p>
                    {(c.author_id === user.id || isOwner) && (
                      <button
                        onClick={() => deleteComment(c.id)}
                        className="text-[10px] text-ink/40 mt-1 hover:text-ink/70"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-ink/50">No comments yet. Say something nice.</p>
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitComment()}
              placeholder="Add a comment"
              className="flex-1 rounded-full border border-ink/10 bg-card px-4 py-2.5 text-sm placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-clay/20"
            />
            <button
              onClick={submitComment}
              disabled={sendingComment || !commentBody.trim()}
              className="size-10 rounded-full bg-clay text-paper grid place-items-center disabled:opacity-50"
              aria-label="Send"
            >
              <Send size={15} strokeWidth={1.75} />
            </button>
          </div>
        </section>
      </div>

      {showShare && (
        <ShareSheet
          recipeId={id}
          userId={user.id}
          onClose={() => setShowShare(false)}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: ["recipe-shares", id] });
            queryClient.invalidateQueries({ queryKey: ["recipe-team-shares", id] });
          }}
        />
      )}
    </div>
  );
}

function Chip({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-creme text-xs text-ink/70 ring-1 ring-black/5">
      {icon}
      {children}
    </span>
  );
}

function ShareSheet({
  recipeId,
  userId,
  onClose,
  onDone,
}: {
  recipeId: string;
  userId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [tab, setTab] = useState<"people" | "teams">("people");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  const { data: myTeams } = useQuery({
    queryKey: ["my-teams", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", userId);
      if (error) throw error;
      if (!data?.length) return [];
      const { data: teams } = await supabase
        .from("teams")
        .select("id,name")
        .in("id", data.map((r) => r.team_id));
      return teams ?? [];
    },
  });

  const { data: currentTeamShares } = useQuery({
    queryKey: ["recipe-team-shares", recipeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipe_team_shares")
        .select("id,team_id")
        .eq("recipe_id", recipeId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const sharedTeamIds = new Set((currentTeamShares ?? []).map((s: any) => s.team_id));

  async function sharePerson() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setBusy(true);
    try {
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("id,email")
        .ilike("email", trimmed)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!profile) {
        toast.error("No user found with that email");
        return;
      }
      if (profile.id === userId) {
        toast.error("You can't share with yourself");
        return;
      }
      const { error } = await supabase.from("recipe_shares").insert({
        recipe_id: recipeId,
        shared_by: userId,
        shared_with: profile.id,
      });
      if (error) {
        if (error.code === "23505") toast.info("Already shared with them");
        else throw error;
      } else {
        toast.success("Shared!");
      }
      setEmail("");
      onDone();
    } catch (err: any) {
      toast.error(err.message ?? "Share failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleTeamShare(teamId: string, currentlyShared: boolean, shareId?: string) {
    try {
      if (currentlyShared && shareId) {
        const { error } = await supabase.from("recipe_team_shares").delete().eq("id", shareId);
        if (error) throw error;
        toast.success("Removed from team");
      } else {
        const { error } = await supabase.from("recipe_team_shares").insert({
          recipe_id: recipeId,
          team_id: teamId,
          shared_by: userId,
        });
        if (error) throw error;
        toast.success("Shared to team");
      }
      queryClient.invalidateQueries({ queryKey: ["recipe-team-shares", recipeId] });
      onDone();
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] bg-paper rounded-t-[28px] p-6 pb-10 animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-2xl">Share this recipe</h3>
          <button onClick={onClose} className="size-8 rounded-full bg-creme grid place-items-center">
            <X size={16} />
          </button>
        </div>

        <div className="inline-flex bg-creme rounded-full p-1 ring-1 ring-black/5 mb-5">
          <TabBtn active={tab === "people"} onClick={() => setTab("people")}>People</TabBtn>
          <TabBtn active={tab === "teams"} onClick={() => setTab("teams")}>Teams</TabBtn>
        </div>

        {tab === "people" ? (
          <>
            <p className="text-sm text-ink/60 mb-4">
              Enter their email — they'll see it instantly in their kitchen.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sharePerson()}
              placeholder="friend@example.com"
              autoFocus
              className="w-full rounded-2xl border border-ink/10 bg-card px-4 py-3.5 text-sm placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-clay/20 mb-4"
            />
            <button
              onClick={sharePerson}
              disabled={busy || !email.trim()}
              className="w-full rounded-full bg-clay text-paper py-3.5 text-sm font-medium disabled:opacity-50"
            >
              {busy ? "Sharing…" : "Share recipe"}
            </button>
          </>
        ) : (
          <>
            {!myTeams || myTeams.length === 0 ? (
              <div className="rounded-[14px] bg-creme/60 ring-1 ring-black/5 p-5 text-center">
                <p className="text-sm text-ink/60 mb-3">
                  You're not in any teams yet. Create one from Settings.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {myTeams.map((t: any) => {
                  const shared = sharedTeamIds.has(t.id);
                  const shareRow = currentTeamShares?.find((s: any) => s.team_id === t.id) as any;
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleTeamShare(t.id, shared, shareRow?.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-[14px] bg-creme/60 ring-1 ring-black/5"
                    >
                      <div className="size-9 rounded-full bg-moss/15 grid place-items-center text-moss">
                        <Users size={15} strokeWidth={1.75} />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm truncate">{t.name}</p>
                      </div>
                      <div
                        className={`size-7 rounded-full grid place-items-center transition-colors ${
                          shared ? "bg-clay text-paper" : "bg-paper ring-1 ring-ink/15 text-transparent"
                        }`}
                      >
                        <Check size={14} strokeWidth={2.25} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
        active ? "bg-ink text-paper" : "text-ink/60"
      }`}
    >
      {children}
    </button>
  );
}
