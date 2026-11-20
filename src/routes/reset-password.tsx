import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set a new password — Pace" }, { name: "description", content: "Choose a new Pace password." }, { property: "og:title", content: "Set a new password — Pace" }, { property: "og:description", content: "Choose a new Pace password." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const [pw, setPw] = useState("");
  const navigate = useNavigate();
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 shadow-card" onSubmit={async (e) => {
        e.preventDefault();
        const { error } = await supabase.auth.updateUser({ password: pw });
        if (error) return void toast.error(error.message);
        toast.success("Password updated");
        navigate({ to: "/dashboard" });
      }}>
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold" aria-label="Pace home">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">P</span> Pace
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Set a new password</h1>
        <label htmlFor="new-password" className="text-sm font-medium">New password</label>
        <Input id="new-password" type="password" autoComplete="new-password" minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 6 characters" />
        <Button className="w-full" type="submit">Update password</Button>
      </form>
    </div>
  );
}
