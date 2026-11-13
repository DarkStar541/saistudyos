import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useProfile, useSave } from "@/lib/db";
import { applyTheme } from "@/lib/theme";
import { PRIORITIES } from "@/lib/task-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QueryState } from "@/components/query-state";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Pace" }, { name: "description", content: "Profile, theme and task defaults." }, { property: "og:title", content: "Settings — Pace" }, { property: "og:description", content: "Profile, theme and task defaults." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: SettingsPage,
});

const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const zones = typeof Intl.supportedValuesOf === "function"
  ? Intl.supportedValuesOf("timeZone")
  : ["UTC", "America/Denver", "America/Los_Angeles", "America/Chicago", "America/New_York", "Europe/London", "Asia/Kolkata"];

const UPCOMING = [
  ["AI Quick Add & Capture Inbox", "Stage 2"],
  ["Canvas LMS", "Stage 3"],
  ["Google Calendar", "Stage 3"],
  ["AI Hub & Knowledge Library", "Stage 4"],
] as const;

function SettingsPage() {
  const profileQuery = useProfile();
  const { data: profile } = profileQuery;
  const save = useSave("profiles");
  const [f, setF] = useState({ display_name: "", school: "", timezone: "UTC", theme: "system", default_task_view: "list", default_priority: "medium", default_duration_minutes: "60", week_starts_on: "1" });

  useEffect(() => {
    if (!profile) return;
    setF({
      display_name: profile.display_name ?? "", school: profile.school ?? "", timezone: profile.timezone, theme: profile.theme,
      default_task_view: profile.default_task_view, default_priority: profile.default_priority,
      default_duration_minutes: String(profile.default_duration_minutes), week_starts_on: String(profile.week_starts_on),
    });
  }, [profile]);

  if (profileQuery.isLoading) return <QueryState loading loadingLabel="Loading your settings…" />;
  if (profileQuery.error) return <QueryState error={profileQuery.error} onRetry={() => { void profileQuery.refetch(); }} />;
  if (!profile) return <QueryState error={new Error("Your profile is unavailable. Please sign in again.")} onRetry={() => { void profileQuery.refetch(); }} />;
  // Keep the saved zone selectable even if the browser omits a legacy IANA alias.
  const timezoneOptions = [...new Set([...zones, profile.timezone])].filter(Boolean).sort();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await save.mutateAsync({
      id: profile!.id, display_name: f.display_name.slice(0, 80) || null, school: f.school.slice(0, 120) || null, timezone: f.timezone,
      theme: f.theme, default_task_view: f.default_task_view, default_priority: f.default_priority,
      default_duration_minutes: Math.max(5, Math.min(600, parseInt(f.default_duration_minutes) || 60)), week_starts_on: +f.week_starts_on,
    });
    applyTheme(f.theme);
    toast.success("Settings saved");
  }

  return (
    <div className="max-w-2xl">
      <div className="page-intro mb-8 border-b border-border/70 pb-6"><p className="overline-label mb-2">MAKE IT YOURS</p><h1 className="text-5xl font-semibold">Settings<span className="text-primary">.</span></h1><p className="mt-2 text-sm text-muted-foreground">Shape your workspace around the way you study.</p></div>
      <form onSubmit={submit} className="space-y-6">
        <Card title="Profile">
          <Row label="Display name"><Input value={f.display_name} onChange={set("display_name")} /></Row>
          <Row label="School"><Input value={f.school} onChange={set("school")} /></Row>
          <Row label="Time zone">
            <Select value={f.timezone} onValueChange={(value) => setF((p) => ({ ...p, timezone: value }))}><SelectTrigger className={sel}><SelectValue placeholder="Choose a time zone" /></SelectTrigger><SelectContent className="max-h-80">{timezoneOptions.map((z) => <SelectItem key={z} value={z}>{z.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select>
          </Row>
        </Card>
        <Card title="Appearance">
          <div className="appearance-mode">
            <div className="mb-3"><p className="text-sm font-medium">Color mode</p><p className="text-xs text-muted-foreground">
              Choose light, dark, or follow your device appearance.
            </p></div>
            <div className="flex flex-wrap gap-2">
              {["light", "dark", "system"].map((t) => (
                <Button key={t} type="button" variant={f.theme === t ? "default" : "outline"} size="sm" className="capitalize" onClick={() => { setF((p) => ({ ...p, theme: t })); applyTheme(t); }}>{t}</Button>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            Pace uses one consistent, neutral design across your workspace. You can still choose light, dark, or system appearance above.
          </div>
          <Row label="Week starts on">
            <Select value={f.week_starts_on} onValueChange={(value) => setF((p) => ({ ...p, week_starts_on: value }))}><SelectTrigger className={sel}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">Monday</SelectItem><SelectItem value="0">Sunday</SelectItem></SelectContent></Select>
          </Row>
        </Card>
        <Card title="Task defaults">
          <Row label="Default task view">
            <Select value={f.default_task_view} onValueChange={(value) => setF((p) => ({ ...p, default_task_view: value }))}><SelectTrigger className={sel}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="list">List</SelectItem><SelectItem value="board">Board</SelectItem><SelectItem value="calendar">Calendar</SelectItem></SelectContent></Select>
          </Row>
          <Row label="Default priority">
            <Select value={f.default_priority} onValueChange={(value) => setF((p) => ({ ...p, default_priority: value }))}><SelectTrigger className={sel}><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent></Select>
          </Row>
          <Row label="Default estimate (min)"><Input type="number" min={5} max={600} value={f.default_duration_minutes} onChange={set("default_duration_minutes")} /></Row>
        </Card>
        <Button type="submit" disabled={save.isPending}>Save settings</Button>
      </form>

      <Card title="Coming next" className="mt-10">
        <p className="text-sm text-muted-foreground">These aren't connected yet — they'll appear here as each stage ships.</p>
        <ul className="mt-2 divide-y divide-border">
          {UPCOMING.map(([n, s]) => <li key={n} className="flex items-center justify-between py-2 text-sm">{n}<Badge variant="secondary">{s}</Badge></li>)}
        </ul>
      </Card>
    </div>
  );
}

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-5 shadow-card ${className ?? ""}`}>
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid items-center gap-1.5 sm:grid-cols-[180px_1fr]"><Label className="text-sm text-muted-foreground">{label}</Label>{children}</div>;
}
