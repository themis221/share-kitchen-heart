import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScreenHeader, Avatar } from "@/components/ui-bits";
import { toast } from "sonner";
import { Moon, LogOut, Users, Plus, ChevronRight, X } from "lucide-react";
import { createTeam } from "@/lib/teams.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsScreen,
});

function SettingsScreen() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [darkMode, setDarkMode] = useState(false);
  const [creatingTeam, setCreatingTeam] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("kt-theme");
    const on = t === "dark";
    setDarkMode(on);
    document.documentElement.classList.toggle("dark", on);
  }, []);

  function toggleDark(v: boolean) {
    setDarkMode(v);
    localStorage.setItem("kt-theme", v ? "dark" : "light");
    document.documentElement.classList.toggle("dark", v);
  }

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name,email,avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: teams } = useQuery({
    queryKey: ["my-teams", user.id],
    queryFn: async () => {
      const { data: memberRows, error } = await supabase
        .from("team_members")
        .select("team_id,role")
        .eq("user_id", user.id);
      if (error) throw error;
      if (!memberRows?.length) return [];
      const { data: teamRows } = await supabase
        .from("teams")
        .select("id,name")
        .in("id", memberRows.map((m) => m.team_id));
      const teamsById = new Map((teamRows ?? []).map((t) => [t.id, t]));
      const withMemberCounts = await Promise.all(
        memberRows.map(async (m) => {
          const { count } = await supabase
            .from("team_members")
            .select("*", { count: "exact", head: true })
            .eq("team_id", m.team_id);
          return {
            id: m.team_id,
            role: m.role as "owner" | "admin" | "member",
            name: teamsById.get(m.team_id)?.name ?? "Team",
            memberCount: count ?? 0,
          };
        }),
      );
      return withMemberCounts;
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const displayName =
    profile?.display_name ?? user.email?.split("@")[0] ?? "Cook";

  return (
    <div>
      <ScreenHeader eyebrow="Your account" title="Settings" />

      <div className="px-6 mb-6">
        <div className="flex items-center gap-4 p-4 rounded-[18px] bg-card ring-1 ring-black/5">
          <Avatar name={displayName} className="size-14 text-base" />
          <div className="min-w-0">
            <p className="font-serif text-lg leading-tight truncate">{displayName}</p>
            <p className="text-xs text-ink/55 truncate">{profile?.email ?? user.email}</p>
          </div>
        </div>
      </div>

      {/* Teams */}
      <div className="px-6 mb-8">
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-[10px] uppercase tracking-widest text-ink/50">Teams</p>
          {teams && teams.length > 0 && (
            <button
              onClick={() => setCreatingTeam(true)}
              className="text-[11px] font-medium text-clay flex items-center gap-1"
            >
              <Plus size={12} strokeWidth={2} /> New team
            </button>
          )}
        </div>
        {teams && teams.length > 0 ? (
          <div className="divide-y divide-ink/5 rounded-[18px] bg-card ring-1 ring-black/5 overflow-hidden">
            {teams.map((t) => (
              <Link
                key={t.id}
                to="/team/$id"
                params={{ id: t.id }}
                className="flex items-center gap-3 px-4 py-4"
              >
                <div className="size-9 rounded-full bg-moss/15 grid place-items-center text-moss">
                  <Users size={15} strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-none truncate">{t.name}</p>
                  <p className="text-[11px] text-ink/50 mt-1">
                    {t.memberCount} member{t.memberCount === 1 ? "" : "s"} · {t.role}
                  </p>
                </div>
                <ChevronRight size={16} className="text-ink/30" />
              </Link>
            ))}
          </div>
        ) : (
          <button
            onClick={() => setCreatingTeam(true)}
            className="w-full rounded-[18px] bg-card ring-1 ring-black/5 p-5 text-left flex items-center gap-3"
          >
            <div className="size-10 rounded-full bg-moss/15 grid place-items-center text-moss">
              <Plus size={17} strokeWidth={1.75} />
            </div>
            <div className="flex-1">
              <p className="font-serif text-base leading-tight">Create your first team</p>
              <p className="text-[11px] text-ink/55 mt-0.5">
                Share recipes with a whole group at once
              </p>
            </div>
          </button>
        )}
      </div>

      <div className="px-6 mb-8">
        <p className="text-[10px] uppercase tracking-widest text-ink/50 mb-3 px-1">Preferences</p>
        <div className="divide-y divide-ink/5 rounded-[18px] bg-card ring-1 ring-black/5 overflow-hidden">
          <Row
            icon={<Moon size={16} strokeWidth={1.75} />}
            label="Night view"
            hint="Easier on evening eyes"
            right={<Switch value={darkMode} onChange={toggleDark} />}
          />
        </div>
      </div>

      <div className="px-6 mb-6">
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 rounded-full border border-ink/10 py-3.5 text-sm font-medium text-ink/70"
        >
          <LogOut size={16} strokeWidth={1.75} /> Sign out
        </button>
      </div>

      <p className="text-center text-[11px] text-ink/40 pb-4">
        The Kitchen Table — made for cooks
      </p>

      {creatingTeam && (
        <CreateTeamSheet
          onClose={() => setCreatingTeam(false)}
          onCreated={(teamId) => {
            setCreatingTeam(false);
            queryClient.invalidateQueries({ queryKey: ["my-teams"] });
            navigate({ to: "/team/$id", params: { id: teamId } });
          }}
        />
      )}
    </div>
  );
}

function Row({
  icon,
  label,
  hint,
  right,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <div className="size-8 rounded-full bg-creme grid place-items-center text-ink/70">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-none">{label}</p>
        {hint && <p className="text-[11px] text-ink/50 mt-1">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

function Switch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`w-11 h-6 rounded-full relative transition-colors ${value ? "bg-clay" : "bg-ink/15"}`}
    >
      <span
        className={`absolute top-1 size-4 bg-paper rounded-full shadow-sm transition-all ${value ? "left-6" : "left-1"}`}
      />
    </button>
  );
}

function CreateTeamSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const data = await createTeam({ data: { name: trimmed } });
      onCreated(data.id);
    } catch (err: any) {
      toast.error(err.message ?? "Couldn't create team");
      setBusy(false);
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
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-serif text-2xl">Create a team</h3>
          <button onClick={onClose} className="size-8 rounded-full bg-creme grid place-items-center">
            <X size={16} />
          </button>
        </div>
        <p className="text-sm text-ink/60 mb-4">
          Teams let you share recipes with a whole group. You'll be the owner.
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="Family kitchen, Sunday supper club…"
          className="w-full rounded-2xl border border-ink/10 bg-card px-4 py-3.5 text-sm placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-clay/20 mb-4"
        />
        <button
          onClick={create}
          disabled={busy || !name.trim()}
          className="w-full rounded-full bg-clay text-paper py-3.5 text-sm font-medium disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create team"}
        </button>
      </div>
    </div>
  );
}
