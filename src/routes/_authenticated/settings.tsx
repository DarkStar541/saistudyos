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

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — StudyOS" }, { name: "description", content: "Profile, theme and task defaults." }, { property: "og:title", content: "Settings — StudyOS" }, { property: "og:description", content: "Profile, theme and task defaults." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: SettingsPage,
});

const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["UTC"];

const UPCOMING = [
  ["AI Quick Add & Capture Inbox", "Stage 2"],
  ["Canvas LMS", "Stage 3"],
  ["Google Calendar", "Stage 3"],
  ["AI Hub & Knowledge Library", "Stage 4"],
] as const;

function SettingsPage() {
  const { data: profile } = useProfile();
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

  if (!profile) return null;
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
      <h1 className="mb-6 text-3xl font-bold">Settings</h1>
      <form onSubmit={submit} className="space-y-6">
        <Card title="Profile">
          <Row label="Display name"><Input value={f.display_name} onChange={set("display_name")} /></Row>
          <Row label="School"><Input value={f.school} onChange={set("school")} /></Row>
          <Row label="Time zone">
            <select className={sel} value={f.timezone} onChange={set("timezone")}>{zones.map((z) => <option key={z}>{z}</option>)}</select>
          </Row>
        </Card>
        <Card title="Appearance">
          <Row label="Theme">
            <div className="flex gap-2">
              {["light", "dark", "system"].map((t) => (
                <Button key={t} type="button" variant={f.theme === t ? "default" : "outline"} size="sm" className="capitalize" onClick={() => { setF((p) => ({ ...p, theme: t })); applyTheme(t); }}>{t}</Button>
              ))}
            </div>
          </Row>
          <Row label="Week starts on">
            <select className={sel} value={f.week_starts_on} onChange={set("week_starts_on")}><option value="1">Monday</option><option value="0">Sunday</option></select>
          </Row>
        </Card>
        <Card title="Task defaults">
          <Row label="Default task view">
            <select className={sel} value={f.default_task_view} onChange={set("default_task_view")}><option value="list">List</option><option value="board">Board</option><option value="calendar">Calendar</option></select>
          </Row>
          <Row label="Default priority">
            <select className={sel} value={f.default_priority} onChange={set("default_priority")}>{PRIORITIES.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}</select>
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
