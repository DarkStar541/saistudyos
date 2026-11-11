import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { addDays, eachDayOfInterval, format, isSameDay, startOfDay, subDays } from "date-fns";
import { Activity, BookOpen, CheckCircle2, Clock3, TrendingUp } from "lucide-react";
import { useCourses, useFocusSessions, useTasks } from "@/lib/db";
import { isOverdue, workDay } from "@/lib/task-utils";
import { Button } from "@/components/ui/button";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({ meta: [{ title: "Insights — StudyOS" }, { name: "description", content: "Understand your workload, completed work and focus habits." }] }),
  component: InsightsPage,
});

type Period = 7 | 30;

function InsightsPage() {
  const { data: tasks = [] } = useTasks();
  const { data: sessions = [] } = useFocusSessions();
  const { data: courses = [] } = useCourses();
  const [period, setPeriod] = useState<Period>(7);
  const today = startOfDay(new Date());
  const start = subDays(today, period - 1);
  const days = eachDayOfInterval({ start, end: today });

  const data = useMemo(() => days.map((day) => {
    const completed = tasks.filter((task) => task.status === "done" && task.completed_at && isSameDay(new Date(task.completed_at), day)).length;
    const focusMinutes = Math.round(sessions.filter((session) => session.kind === "focus" && isSameDay(new Date(session.started_at), day)).reduce((sum, session) => sum + session.duration_seconds, 0) / 60);
    const plannedMinutes = tasks.filter((task) => task.status !== "done" && workDay(task) && isSameDay(workDay(task)!, day)).reduce((sum, task) => sum + (task.estimated_minutes ?? 60), 0);
    return { day: format(day, period === 7 ? "EEE" : "MMM d"), completed, focusMinutes, plannedMinutes };
  }), [days, tasks, sessions, period]);

  const completedInPeriod = tasks.filter((task) => task.status === "done" && task.completed_at && new Date(task.completed_at) >= start).length;
  const focusSeconds = sessions.filter((session) => session.kind === "focus" && new Date(session.started_at) >= start).reduce((sum, session) => sum + session.duration_seconds, 0);
  const overdue = tasks.filter((task) => isOverdue(task)).length;
  const activeCourses = courses.filter((course) => !course.archived).length;
  const heatmapDays = eachDayOfInterval({ start: subDays(today, 27), end: today }).map((day) => {
    const completed = tasks.filter((task) => task.status === "done" && task.completed_at && isSameDay(new Date(task.completed_at), day)).length;
    const focus = sessions.filter((session) => session.kind === "focus" && isSameDay(new Date(session.started_at), day)).reduce((sum, session) => sum + session.duration_seconds, 0);
    return { day, score: completed + Math.floor(focus / 1800) };
  });
  const maxScore = Math.max(1, ...heatmapDays.map((d) => d.score));

  return (
    <div>
      <header className="page-intro mb-8 flex flex-wrap items-end gap-4 border-b border-border/70 pb-6">
        <div className="mr-auto"><p className="overline-label mb-2">YOUR STUDY PATTERNS</p><h1 className="text-5xl font-semibold">Insights<span className="text-primary">.</span></h1><p className="mt-2 text-sm text-muted-foreground">A clearer picture of the work behind your progress.</p></div>
        <div className="flex gap-1 rounded-lg bg-muted p-1">{([7, 30] as Period[]).map((p) => <Button key={p} size="sm" variant={period === p ? "default" : "ghost"} onClick={() => setPeriod(p)}>{p} days</Button>)}</div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<CheckCircle2 className="size-4" />} label={`Completed · ${period} days`} value={String(completedInPeriod)} />
        <Metric icon={<Clock3 className="size-4" />} label="Focus time" value={`${Math.floor(focusSeconds / 3600)}h ${Math.round((focusSeconds % 3600) / 60)}m`} />
        <Metric icon={<Activity className="size-4" />} label="Overdue now" value={String(overdue)} />
        <Metric icon={<BookOpen className="size-4" />} label="Active courses" value={String(activeCourses)} />
      </div>

      <section className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-card">
        <div className="mb-5 flex items-center gap-2"><TrendingUp className="size-4 text-primary" /><div><h2 className="font-semibold">Daily activity</h2><p className="text-xs text-muted-foreground">Completed tasks and recorded focus minutes</p></div></div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, color: "hsl(var(--popover-foreground))" }} />
              <Bar dataKey="completed" name="Tasks completed" fill="hsl(var(--primary))" radius={[5, 5, 0, 0]} />
              <Bar dataKey="focusMinutes" name="Focus minutes" fill="hsl(var(--chart-2))" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-semibold">Consistency · last 28 days</h2>
        <p className="mt-1 text-xs text-muted-foreground">Each square represents completed work and focus activity that day.</p>
        <div className="mt-4 grid grid-cols-7 gap-2 sm:grid-cols-14">
          {heatmapDays.map(({ day, score }) => <div key={day.toISOString()} title={`${format(day, "MMM d")}: activity ${score}`} aria-label={`${format(day, "MMM d")}: activity ${score}`} className="aspect-square rounded-md border border-border" style={{ backgroundColor: score ? `hsl(var(--primary) / ${0.16 + 0.78 * score / maxScore})` : "hsl(var(--muted))" }} />)}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-semibold">Upcoming workload</h2>
        <p className="mt-1 text-xs text-muted-foreground">Estimated unfinished work by day for the selected period.</p>
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, color: "hsl(var(--popover-foreground))" }} />
              <Bar dataKey="plannedMinutes" name="Planned minutes" fill="hsl(var(--chart-3))" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <section className="rounded-2xl border border-border bg-card p-4 shadow-card"><div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div><p className="mt-3 font-display text-3xl font-semibold tabular-nums">{value}</p></section>;
}
