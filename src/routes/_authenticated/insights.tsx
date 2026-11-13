import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFocusSessions, useProfile, useTasks } from "@/lib/db";
import { dateKeyInTimeZone, parsePlanned } from "@/lib/task-utils";
import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({ meta: [{ title: "Insights — Pace" }, { name: "description", content: "Understand your study patterns and focus habits." }] }),
  component: InsightsPage,
});

type Period = 7 | 30 | 90;
const keyDate = (key: string) => parsePlanned(key) ?? parseISO(key);

function InsightsPage() {
  const profileQuery = useProfile();
  const tasksQuery = useTasks();
  const sessionsQuery = useFocusSessions();
  const profile = profileQuery.data;
  const tasks = tasksQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];
  const [period, setPeriod] = useState<Period>(30);
  const timeZone = profile?.timezone;

  const data = useMemo(() => {
    const today = dateKeyInTimeZone(new Date(), timeZone);
    const todayDate = keyDate(today);
    const days = Array.from({ length: period }, (_, index) => {
      const date = addDays(todayDate, index - period + 1);
      const key = dateKeyInTimeZone(date, timeZone);
      return { key, label: format(date, period === 7 ? "EEE" : "MMM d"), focusMinutes: 0, completedTasks: 0, plannedTasks: 0 };
    });
    const byKey = new Map(days.map((day) => [day.key, day]));
    for (const session of sessions) {
      if (session.kind !== "focus") continue;
      const bucket = byKey.get(dateKeyInTimeZone(new Date(session.started_at), timeZone));
      if (bucket) bucket.focusMinutes += Math.round(session.duration_seconds / 60);
    }
    for (const task of tasks) {
      if (task.completed_at) {
        const bucket = byKey.get(dateKeyInTimeZone(new Date(task.completed_at), timeZone));
        if (bucket) bucket.completedTasks += 1;
      }
      if (task.planned_date) {
        const bucket = byKey.get(task.planned_date);
        if (bucket && task.status !== "done") bucket.plannedTasks += 1;
      }
    }
    const heatStart = addDays(todayDate, -83);
    const heat = Array.from({ length: 84 }, (_, index) => {
      const date = addDays(heatStart, index);
      const key = dateKeyInTimeZone(date, timeZone);
      const minutes = sessions.filter((session) => session.kind === "focus" && dateKeyInTimeZone(new Date(session.started_at), timeZone) === key)
        .reduce((sum, session) => sum + session.duration_seconds, 0) / 60;
      return { key, label: format(date, "MMM d"), minutes: Math.round(minutes) };
    });
    const totalFocus = days.reduce((sum, day) => sum + day.focusMinutes, 0);
    const completed = days.reduce((sum, day) => sum + day.completedTasks, 0);
    const average = Math.round(totalFocus / period);
    return { days, heat, totalFocus, completed, average, activeDays: heat.filter((day) => day.minutes > 0).length };
  }, [tasks, sessions, period, timeZone]);

  if (profileQuery.isLoading || tasksQuery.isLoading || sessionsQuery.isLoading) return <QueryState loading loadingLabel="Building your insights…" />;
  const error = profileQuery.error ?? tasksQuery.error ?? sessionsQuery.error;
  if (error) return <QueryState error={error} onRetry={() => { void Promise.all([profileQuery.refetch(), tasksQuery.refetch(), sessionsQuery.refetch()]); }} />;
  if (!profile) return <QueryState error={new Error("Your profile is unavailable. Please sign in again.")} />;

  const maxMinutes = Math.max(1, ...data.heat.map((day) => day.minutes));
  return (
    <div>
      <header className="page-intro mb-8 flex flex-wrap items-end gap-4 border-b border-border/70 pb-6">
        <div className="mr-auto"><p className="overline-label mb-2">YOUR STUDY PATTERNS</p><h1 className="text-5xl font-semibold">Insights<span className="text-primary">.</span></h1><p className="mt-2 text-sm text-muted-foreground">A clearer picture of where your time goes.</p></div>
        <div className="flex gap-1 rounded-lg bg-muted p-1" aria-label="Insight period">
          {([7, 30, 90] as Period[]).map((value) => <Button key={value} size="sm" variant={period === value ? "secondary" : "ghost"} aria-pressed={period === value} onClick={() => setPeriod(value)}>{value} days</Button>)}
        </div>
      </header>
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Metric label={`Focus time · ${period} days`} value={`${Math.floor(data.totalFocus / 60)}h ${data.totalFocus % 60}m`} />
        <Metric label="Tasks completed" value={String(data.completed)} />
        <Metric label="Average focus / day" value={`${data.average} min`} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-semibold">Daily focus</h2><p className="mt-1 text-sm text-muted-foreground">Minutes spent in recorded focus sessions.</p>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.days} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} interval={period === 90 ? 13 : period === 30 ? 4 : 0} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Bar dataKey="focusMinutes" name="Focus minutes" fill="var(--primary)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-semibold">Completed work</h2><p className="mt-1 text-sm text-muted-foreground">Tasks marked complete on each day.</p>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.days} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} interval={period === 90 ? 13 : period === 30 ? 4 : 0} />
                <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Bar dataKey="completedTasks" name="Completed tasks" fill="var(--chart-2)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <section className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="font-semibold">Focus activity</h2><p className="mt-1 text-sm text-muted-foreground">The last 12 weeks, based on your saved timezone.</p></div><p className="text-sm text-muted-foreground">{data.activeDays} active days</p></div>
        <div className="mt-5 grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto pb-2">
          {data.heat.map((day) => {
            const intensity = day.minutes === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((day.minutes / maxMinutes) * 4)));
            return <div key={day.key} title={`${day.label}: ${day.minutes} focus minutes`} aria-label={`${day.label}: ${day.minutes} focus minutes`} className="size-3.5 rounded-[3px] border border-border/50" style={{ background: intensity ? `color-mix(in srgb, var(--primary) ${intensity * 20}%, var(--muted))` : "var(--muted)" }} />;
          })}
        </div>
        <div className="mt-2 flex items-center justify-end gap-2 text-xs text-muted-foreground"><span>Less</span>{[0,1,2,3,4].map((level) => <span key={level} className="size-3 rounded-[3px] border border-border/50" style={{ background: level ? `color-mix(in srgb, var(--primary) ${level * 20}%, var(--muted))` : "var(--muted)" }} />)}<span>More</span></div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <section className="rounded-2xl border border-border bg-card p-5 shadow-card"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p></section>;
}
