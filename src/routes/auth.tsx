import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteShell } from "@/components/site-shell";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — The Ripple Effect" },
      {
        name: "description",
        content:
          "Sign in to keep a private paper trade blotter of the signals you choose to track. Research only, no investment advice.",
      },
      { property: "og:title", content: "Sign in — The Ripple Effect" },
      {
        property: "og:description",
        content: "Private paper trade blotter for event-driven exposure research.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { signedIn, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && signedIn) navigate({ to: "/blotter", replace: true });
  }, [loading, signedIn, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/auth" },
        });
        if (err) throw err;
        if (!data.session) {
          setInfo("Check your email and click the confirmation link to finish signing up.");
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (res?.error) setError(res.error.message ?? "Google sign-in failed");
  }

  return (
    <SiteShell>
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your paper trade blotter is private to your account. Everything stays paper —
          there is no live execution anywhere in this app.
        </p>

        <div className="mt-5 rounded-xl border border-border/70 bg-card/60 p-5">
          <button
            type="button"
            onClick={google}
            className="w-full rounded-md border border-border/70 px-3 py-2 text-sm hover:bg-accent transition-colors"
          >
            Continue with Google
          </button>

          <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span className="h-px flex-1 bg-border/70" /> or email <span className="h-px flex-1 bg-border/70" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm"
              />
            </div>
            {error && <p className="text-xs text-headwind">{error}</p>}
            {info && <p className="text-xs text-tailwind">{info}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setInfo(null);
            }}
            className="mt-4 text-xs text-primary hover:underline"
          >
            {mode === "signin"
              ? "No account yet? Create one"
              : "Already have an account? Sign in"}
          </button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          New here? The{" "}
          <Link to="/manual" className="text-primary hover:underline">
            manual
          </Link>{" "}
          explains how signals and the blotter work.
        </p>
      </div>
    </SiteShell>
  );
}
