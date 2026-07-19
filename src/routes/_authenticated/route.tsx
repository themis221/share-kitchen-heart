import { createFileRoute, Outlet, redirect, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Home, BookOpen, Settings as SettingsIcon, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="max-w-[440px] mx-auto min-h-screen relative pb-28">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}

function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const isActive = (p: string) =>
    p === "/home" ? path === "/home" : path.startsWith(p);

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] bg-paper/95 backdrop-blur-md border-t border-ink/5 px-8 pt-3 pb-6 flex justify-between items-center z-40">
      <NavItem to="/home" label="Home" icon={<Home size={18} strokeWidth={1.75} />} active={isActive("/home")} />
      <NavItem to="/recipes" label="Library" icon={<BookOpen size={18} strokeWidth={1.75} />} active={isActive("/recipes")} />
      <div className="-mt-10">
        <button
          onClick={() => navigate({ to: "/add" })}
          aria-label="Add recipe"
          className="size-14 rounded-full bg-ink text-paper flex items-center justify-center shadow-xl ring-4 ring-paper transition-transform active:scale-95"
        >
          <Plus size={22} strokeWidth={1.75} />
        </button>
      </div>
      <NavItem to="/recipes" label="Shared" icon={<BookOpen size={18} strokeWidth={1.75} />} active={false} search={{ tab: "shared" }} />
      <NavItem to="/settings" label="Settings" icon={<SettingsIcon size={18} strokeWidth={1.75} />} active={isActive("/settings")} />
    </nav>
  );
}

function NavItem({
  to,
  label,
  icon,
  active,
  search,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  search?: Record<string, string>;
}) {
  return (
    <Link
      to={to}
      search={search as never}
      className={`flex flex-col items-center gap-1 ${active ? "text-clay" : "text-ink/40"}`}
    >
      {icon}
      <span className="text-[9px] font-medium uppercase tracking-[0.15em]">{label}</span>
    </Link>
  );
}
