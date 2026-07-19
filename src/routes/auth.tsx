import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { name },
          },
        });
        if (error) throw error;
        toast.success("Account created!");
        navigate({ to: "/home", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/home", replace: true });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (!result.redirected) navigate({ to: "/home", replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Google sign-in failed");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col px-6 py-10">
      <Link to="/" className="text-xs text-ink/50 uppercase tracking-[0.2em] mb-10">
        ← Back
      </Link>
      <div className="max-w-sm mx-auto w-full">
        <h1 className="font-serif text-4xl mb-2 text-balance">
          {mode === "signup" ? "Pull up a chair" : "Welcome back"}
        </h1>
        <p className="text-sm text-ink/60 mb-8">
          {mode === "signup"
            ? "Start your recipe collection today."
            : "Sign in to your kitchen."}
        </p>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="w-full rounded-2xl border border-ink/10 bg-card py-3.5 text-sm font-medium flex items-center justify-center gap-2 mb-5 disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-ink/10" />
          <span className="text-[10px] uppercase tracking-widest text-ink/40">or</span>
          <div className="flex-1 h-px bg-ink/10" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl border border-ink/10 bg-card px-4 py-3.5 text-sm placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-clay/20"
            />
          )}
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-ink/10 bg-card px-4 py-3.5 text-sm placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-clay/20"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border border-ink/10 bg-card px-4 py-3.5 text-sm placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-clay/20"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-clay text-paper py-3.5 text-sm font-medium disabled:opacity-60 transition-transform active:scale-[0.98]"
          >
            {busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="mt-6 w-full text-center text-xs text-ink/60"
        >
          {mode === "signup"
            ? "Have an account? Sign in"
            : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}
