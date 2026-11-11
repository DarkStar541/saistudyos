import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useProfile, useSave } from "@/lib/db";
import { applyTheme, applyStyle, getSavedStyle, type VisualStyle } from "@/lib/theme";
import { PRIORITIES } from "@/lib/task-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — StudyOS" }, { name: "description", content: "Profile, theme and task defaults." }, { property: "og:title", content: "Settings — StudyOS" }, { property: "og:description", content: "Profile, theme and task defaults." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
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
  const { data: profile } = useProfile();
  const save = useSave("profiles");
  const [visualStyle, setVisualStyle] = useState<VisualStyle>("evergreen");
  useEffect(() => { setVisualStyle(getSavedStyle()); }, []);
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
              Choose light or dark independently of your visual style. Nocturne keeps its intentionally dark
              console palette.
            </p></div>
            <div className="flex flex-wrap gap-2">
              {["light", "dark", "system"].map((t) => (
                <Button key={t} type="button" variant={f.theme === t ? "default" : "outline"} size="sm" className="capitalize" onClick={() => { setF((p) => ({ ...p, theme: t })); applyTheme(t); }}>{t}</Button>
              ))}
            </div>
          </div>
          <div className="pt-2">
            <div className="mb-3"><p className="text-sm font-medium">Visual style</p><p className="text-xs text-muted-foreground">Five distinct design languages. Your choice applies across the entire workspace.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                { id: "evergreen", name: "Evergreen", note: "Botanical · editorial · warm", swatches: ["#203f32", "#e9e6d8", "#a7b28a"], preview: "evergreen" },
                { id: "paper-ink", name: "Paper & Ink", note: "Quiet · literary · monochrome", swatches: ["#242424", "#f4f0e8", "#b7afa0"], preview: "paper" },
                { id: "nocturne", name: "Nocturne", note: "Atmospheric · dramatic · focused", swatches: ["#171d2c", "#29364b", "#d2ad78"], preview: "nocturne" },
                { id: "daydream", name: "Daydream", note: "Expressive · bright · playful", swatches: ["#6555a5", "#f2e9ff", "#efb7a7"], preview: "daydream" },
                { id: "ember-aurora", name: "Ember Aurora", note: "Frosted glass · ember glow · aurora", swatches: ["#a65332", "#f5eee4", "#a88bd8"], preview: "ember-aurora" },
              ] as const).map((item) => (
                <button key={item.id} type="button" onClick={() => { setVisualStyle(item.id); applyStyle(item.id); }}
                  aria-pressed={visualStyle === item.id}
                  className={`style-choice text-left ${visualStyle === item.id ? "is-selected" : ""}`}>
                  <div className={`style-preview style-preview-${item.preview}`}>
                    <div className="style-preview-sidebar"><i /><i /><i /></div>
                    <div className="style-preview-main"><b /><span /><span /><div><i /><i /><i /></div></div>
                  </div>
                  <div className="flex items-start justify-between gap-2 pt-3">
                    <div><p className="font-semibold">{item.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.note}</p></div>
                    <span className="flex shrink-0 gap-1 pt-1">{item.swatches.map((color) => <i key={color} className="size-3 rounded-full ring-1 ring-black/10" style={{ background: color }} />)}</span>
                  </div>
                  {visualStyle === item.id && <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">✓ Selected</span>}
                </button>
              ))}
            </div>
          </div>
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
