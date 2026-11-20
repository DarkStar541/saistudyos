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

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const UPCOMING = [
  ["AI Quick Add & Capture Inbox", "Planned"],
  ["Canvas LMS", "Stage 3"],
  ["Google Calendar", "Stage 3"],
  ["AI Hub & Knowledge Library", "Stage 4"],
] as const;

function SettingsPage() {
  const profileQuery = useProfile();
  const { data: profile } = profileQuery;
  const save = useSave("profiles");
  const [f, setF] = useState({ display_name: "", school: "", timezone: "UTC", theme: "system", default_task_view: "list", default_priority: "medium", default_duration_minutes: "60", week_starts_on: "1", focus_minutes: "25", short_break_minutes: "5", long_break_minutes: "15", long_break_every: "4" });
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      toast.success("Pace was added to your device");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function installPace() {
    if (!installPrompt || installing) return;
    setInstalling(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstallPrompt(null);
    } catch {
      toast.error("Pace couldn't open the install prompt. Use your browser menu instead.");
    } finally {
      setInstalling(false);
    }
  }

  useEffect(() => {
    if (!profile) return;
    setF({
      display_name: profile.display_name ?? "", school: profile.school ?? "", timezone: profile.timezone, theme: profile.theme,
      default_task_view: profile.default_task_view, default_priority: profile.default_priority,
      default_duration_minutes: String(profile.default_duration_minutes), week_starts_on: String(profile.week_starts_on),
      focus_minutes: String(profile.focus_minutes), short_break_minutes: String(profile.short_break_minutes), long_break_minutes: String(profile.long_break_minutes), long_break_every: String(profile.long_break_every),
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
      focus_minutes: Math.max(5, Math.min(180, parseInt(f.focus_minutes) || 25)), short_break_minutes: Math.max(1, Math.min(60, parseInt(f.short_break_minutes) || 5)),
      long_break_minutes: Math.max(1, Math.min(60, parseInt(f.long_break_minutes) || 15)), long_break_every: Math.max(2, Math.min(12, parseInt(f.long_break_every) || 4)),
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
        <Card title="Install Pace on your phone">
          <p className="text-sm text-muted-foreground">Add Pace to your home screen for a full-screen app experience and faster access to task capture. Sign in with the same account you use on the web.</p>
          {isInstalled ? (
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm font-medium">Pace is installed on this device.</p>
          ) : installPrompt ? (
            <Button type="button" onClick={installPace} disabled={installing} className="w-full sm:w-auto">
              {installing ? "Opening install prompt…" : "Install Pace"}
            </Button>
          ) : null}
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-sm font-medium">iPhone or iPad</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Open <a className="font-medium text-foreground underline underline-offset-4" href="https://saispace.lovable.app">saispace.lovable.app</a> in Safari.</li>
              <li>Tap Share, then Add to Home Screen.</li>
              <li>Leave “Open as Web App” enabled, then tap Add.</li>
            </ol>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-sm font-medium">Android</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Open Pace in Chrome.</li>
              <li>Open the browser menu and choose Install app (or Add to Home screen).</li>
              <li>Confirm the installation.</li>
            </ol>
          </div>
          <p className="text-xs text-muted-foreground">Pace uses the same online account and data as the website. Offline task creation and native app-store distribution are not enabled yet.</p>
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
