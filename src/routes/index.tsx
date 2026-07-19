import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home", replace: true });
      else setChecked(true);
    });
  }, [navigate]);

  if (!checked) {
    return <div className="min-h-screen bg-paper" />;
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-8 max-w-[420px] mx-auto w-full">
        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-ink/50 mb-4">
          A personal recipe database
        </p>
        <h1 className="font-serif text-5xl leading-[1.05] mb-6 text-balance">
          The Kitchen Table
        </h1>
        <p className="text-ink/70 text-base leading-relaxed mb-10 max-w-sm">
          Save, scan, and share recipes with the people you cook with. Everything you love,
          in one warm place.
        </p>
        <button
          onClick={() => navigate({ to: "/auth" })}
          className="rounded-full bg-ink text-paper py-4 text-sm font-medium tracking-wide transition-transform active:scale-[0.98]"
        >
          Get started
        </button>
        <button
          onClick={() => navigate({ to: "/auth" })}
          className="mt-3 rounded-full border border-ink/10 bg-transparent text-ink py-4 text-sm font-medium tracking-wide"
        >
          I already have an account
        </button>
      </div>
      <p className="text-center text-xs text-ink/40 pb-8">Made for cooks and their people</p>
    </div>
  );
}
