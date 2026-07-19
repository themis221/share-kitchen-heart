import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScreenHeader, Avatar } from "@/components/ui-bits";
import { toast } from "sonner";
import { Moon, LogOut, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsScreen,
});

function SettingsScreen() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [darkMode, setDarkMode] = useState(false);

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

  const { data: sharedCount } = useQuery({
    queryKey: ["shares-out", user.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("recipe_shares")
        .select("*", { count: "exact", head: true })
        .eq("shared_by", user.id);
      if (error) throw error;
      return count ?? 0;
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

      <div className="px-6 mb-8">
        <p className="text-[10px] uppercase tracking-widest text-ink/50 mb-3 px-1">Preferences</p>
        <div className="divide-y divide-ink/5 rounded-[18px] bg-card ring-1 ring-black/5 overflow-hidden">
          <Row
            icon={<Moon size={16} strokeWidth={1.75} />}
            label="Night view"
            hint="Easier on evening eyes"
            right={<Switch value={darkMode} onChange={toggleDark} />}
          />
          <Row
            icon={<Users size={16} strokeWidth={1.75} />}
            label="Recipes you've shared"
            right={<span className="text-xs font-medium text-clay">{sharedCount ?? 0}</span>}
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
