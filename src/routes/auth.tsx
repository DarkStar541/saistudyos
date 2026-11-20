import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import "@lovable.dev/cloud-auth-js/styles.css";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Pace" },
      { name: "description", content: "Sign in or create your private Pace workspace." },
      { property: "og:title", content: "Sign in — Pace" },
      { property: "og:description", content: "Sign in or create your private Pace workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // getSession reads the persisted session locally. getUser() performs an
    // avoidable network validation just to decide whether to leave this page.
    void supabase.auth.getSession().then(({ data }) => {
      if (active && data.session?.user) {
        void navigate({ to: "/dashboard", replace: true });
      }
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        void navigate({ to: "/dashboard", replace: true });
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: name } } });
        if (error) throw error;
        if (!data.session) setSent("Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setSent("If that email has an account, a reset link is on its way.");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function oauth(p: "google" | "lovable") {
    const r = await lovable.auth.signInWithOAuth(p, { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error(r.error.message ?? "Sign-in failed");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link to="/" className="mb-5 inline-flex items-center gap-2.5" aria-label="Pace home">
            <span className="grid size-9 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">P</span>
            <span className="text-xl font-semibold tracking-tight">Pace</span>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{mode === "signup" ? "Create your workspace" : mode === "forgot" ? "Reset password" : "Welcome back"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{mode === "signup" ? "Create your own private study workspace." : "Your courses and deadlines, all in one place."}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          {sent ? (
            <div className="space-y-4 text-center text-sm"><p>{sent}</p><Button variant="outline" onClick={() => { setSent(null); setMode("signin"); }}>Back to sign in</Button></div>
          ) : (
            <>
              {mode !== "forgot" && (
                <div className="space-y-2">
                  <Button variant="outline" className="w-full" onClick={() => oauth("google")}>Continue with Google</Button>
                  <button type="button" className="lovable-auth-button w-full" onClick={() => oauth("lovable")}>Continue with Lovable</button>
                  <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
                </div>
              )}
              {mode === "signup" && <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">Your courses, tasks, projects and focus history belong to your account. Other Pace users cannot see your workspace.</p>}
              <form onSubmit={submit} className="space-y-3">
                {mode === "signup" && <div className="space-y-1"><Label htmlFor="name">Name</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} /></div>}
                <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                {mode !== "forgot" && <div className="space-y-1"><Label htmlFor="pw">Password</Label><Input id="pw" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>}
                <Button type="submit" className="w-full" disabled={busy}>{mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}</Button>
              </form>
              <div className="mt-4 flex justify-between text-sm">
                {mode === "signin" ? (
                  <><button className="text-muted-foreground hover:text-foreground" onClick={() => setMode("forgot")}>Forgot password?</button><button className="font-medium text-primary" onClick={() => setMode("signup")}>Create account</button></>
                ) : (
                  <button className="font-medium text-primary" onClick={() => setMode("signin")}>Back to sign in</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
