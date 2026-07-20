import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RecipeThumb, Avatar, relativeTime } from "@/components/ui-bits";
import { toast } from "sonner";
import { ArrowLeft, Share2, Trash2, Users, X, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/recipe/$id")({
  component: RecipeDetail,
});

function RecipeDetail() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showShare, setShowShare] = useState(false);

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
            <div className="rounded-[16px] bg-creme/60 ring-1 ring-black/5 p-5 whitespace-pre-line text-sm leading-relaxed">
              {recipe.ingredients}
            </div>
          </section>
        )}

        {recipe.instructions && (
          <section className="mb-8">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink/60 mb-3">
              Instructions
            </h2>
            <div className="whitespace-pre-line text-[15px] leading-relaxed text-ink/85">
              {recipe.instructions}
            </div>
          </section>
        )}

        {isOwner && sharedWith && sharedWith.length > 0 && (
          <section className="mb-8">
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
      </div>

      {showShare && (
        <ShareSheet
          recipeId={id}
          userId={user.id}
          onClose={() => setShowShare(false)}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: ["recipe-shares", id] });
            setShowShare(false);
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
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function share() {
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
        setBusy(false);
        return;
      }
      if (profile.id === userId) {
        toast.error("You can't share with yourself");
        setBusy(false);
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-[440px] bg-paper rounded-t-[28px] p-6 pb-10 animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-serif text-2xl">Share this recipe</h3>
          <button onClick={onClose} className="size-8 rounded-full bg-creme grid place-items-center">
            <X size={16} />
          </button>
        </div>
        <p className="text-sm text-ink/60 mb-4">
          Enter the email of the person you want to share this recipe with. They'll see it
          instantly in their kitchen.
        </p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && share()}
          placeholder="friend@example.com"
          autoFocus
          className="w-full rounded-2xl border border-ink/10 bg-card px-4 py-3.5 text-sm placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-clay/20 mb-4"
        />
        <button
          onClick={share}
          disabled={busy || !email.trim()}
          className="w-full rounded-full bg-clay text-paper py-3.5 text-sm font-medium disabled:opacity-50"
        >
          {busy ? "Sharing…" : "Share recipe"}
        </button>
      </div>
    </div>
  );
}
