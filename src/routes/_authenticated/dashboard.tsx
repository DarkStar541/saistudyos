import { createFileRoute, Link } from "@tanstack/react-router";
import { useId, useMemo, useState } from "react";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, GripVertical, Plus, Settings2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { colorVar, useCourses, useFocusSessions, useProfile, useSave, useTasks, type Course, type Task } from "@/lib/db";
import { calendarDays, isDone, isForToday, isOverdue, isUpcoming, toDateKey, weeklyWorkload } from "@/lib/task-utils";
import { CalendarTask } from "@/components/calendar-task";
import { TaskRow } from "@/components/task-row";
import { TaskDialog } from "@/components/task-dialog";
import { CourseIcon } from "@/components/course-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — StudyOS" }, { name: "description", content: "Today's work, deadlines and exams at a glance." }, { property: "og:title", content: "Dashboard — StudyOS" }, { property: "og:description", content: "Today's work, deadlines and exams at a glance." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Dashboard,
});

export const WIDGETS: Record<string, { label: string; wide?: boolean }> = {
  quickadd: { label: "Quick capture", wide: true },
  today: { label: "Today" },
  overdue: { label: "Overdue" },
  upcoming: { label: "Upcoming assignments" },
  exams: { label: "Upcoming exams" },
  calendar: { label: "This week", wide: true },
  workload: { label: "Weekly workload" },
  courses: { label: "Recent courses" },
  ai: { label: "AI assistant" },
};

// Gauge targets. Constants for now; they can move into Settings later.
const FOCUS_GOAL_MIN = 120;
const WEEK_CAPACITY_MIN = 1200;

function Dashboard() {
  const { data: profile } = useProfile();
  const { data: tasks = [] } = useTasks();
  const { data: courses = [] } = useCourses();
  const { data: sessions = [] } = useFocusSessions();
  const saveProfile = useSave("profiles");
  const [customizing, setCustomizing] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const courseMap = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);

  const layout = ((profile?.dashboard_widgets as string[] | undefined) ?? []).filter((k) => WIDGETS[k]);
  const hidden = Object.keys(WIDGETS).filter((k) => !layout.includes(k));
  const persist = (next: string[]) => profile && saveProfile.mutate({ id: profile.id, dashboard_widgets: next });
  const moveTo = (key: string, idx: number) => {
    const next = layout.filter((k) => k !== key);
    next.splice(Math.max(0, Math.min(idx, next.length)), 0, key);
    persist(next);
  };

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const ctx = { tasks, courses, courseMap, onOpen: setEditing, weekStartsOn: (profile?.week_starts_on ?? 1) as 0 | 1, fallback: profile?.default_duration_minutes ?? 60 };

  const plannedToday = tasks.filter((t) => isForToday(t)).length;
  const dueThisWeek = tasks.filter((t) => isUpcoming(t, 7)).length;
  const overdueCount = tasks.filter((t) => isOverdue(t)).length;

  const todayKey = toDateKey(new Date());
  const doneToday = tasks.filter((t) => isDone(t) && t.completed_at && toDateKey(new Date(t.completed_at)) === todayKey).length;
  const todayTotal = doneToday + plannedToday;
  const focusMin = Math.round(sessions.filter((s) => s.kind === "focus" && toDateKey(new Date(s.started_at)) === todayKey).reduce((a, s) => a + s.duration_seconds, 0) / 60);
  const weekMin = weeklyWorkload(tasks, new Date(), ctx.weekStartsOn, ctx.fallback).reduce((a, d) => a + d.minutes, 0);
  const weekLoad = weekMin / WEEK_CAPACITY_MIN;
  const hrs = (m: number) => `${Math.round((m / 60) * 10) / 10}h`;
  const stats: { value: number; label: string; tone?: "danger" | undefined }[] = [
    { value: plannedToday, label: "planned today" },
    { value: dueThisWeek, label: "due this week" },
    { value: overdueCount, label: "overdue", tone: overdueCount ? "danger" : undefined },
  ];

  return (
    <div>
      <header className="mb-10 flex flex-wrap items-end gap-x-8 gap-y-6">
        <div className="mr-auto">
          <p className="overline-label">{format(new Date(), "EEEE, MMMM d")}</p>
          <h1 className="mt-2 text-5xl leading-[1.05] md:text-7xl">
            {greet}{profile?.display_name ? `, ${profile.display_name.split(" ")[0]}` : ""}
          </h1>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
            {stats.map((s) => (
              <span key={s.label} className="flex items-baseline gap-1.5">
                <span className={cn("font-display text-2xl font-semibold", s.tone === "danger" ? "text-destructive" : "text-foreground")}>{s.value}</span>
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-start justify-center gap-x-2">
          <Gauge value={todayTotal ? doneToday / todayTotal : 0} label={`${doneToday}/${todayTotal}`} sub="done today" />
          <Gauge value={focusMin / FOCUS_GOAL_MIN} label={focusMin >= 60 ? hrs(focusMin) : `${focusMin}m`} sub={`of ${hrs(FOCUS_GOAL_MIN)} focus`} />
          <Gauge value={weekLoad} label={hrs(weekMin)} sub="planned this week" tone={weekLoad > 1 ? "danger" : weekLoad > 0.8 ? "warn" : undefined} />
        </div>
        <Button variant={customizing ? "default" : "outline"} size="sm" onClick={() => setCustomizing((c) => !c)}>
          {customizing ? <><Check className="size-4" /> Done</> : <><Settings2 className="size-4" /> Customize</>}
        </Button>
      </header>

      {customizing && hidden.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border p-3 text-sm">
          <span className="text-muted-foreground">Add widget:</span>
          {hidden.map((k) => <Button key={k} size="sm" variant="secondary" onClick={() => persist([...layout, k])}><Plus className="size-3.5" /> {WIDGETS[k]?.label}</Button>)}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {layout.map((key, i) => (
          <div
            key={key}
            draggable={customizing}
            onDragStart={() => setDragKey(key)}
            onDragOver={(e) => customizing && e.preventDefault()}
            onDrop={() => { if (dragKey && dragKey !== key) moveTo(dragKey, i); setDragKey(null); }}
            className={cn(
              "relative rounded-3xl border border-border bg-card p-6 shadow-card transition-shadow",
              !customizing && "hover:shadow-lift",
              WIDGETS[key]?.wide && "md:col-span-2",
              customizing && "cursor-move ring-1 ring-primary/30",
              dragKey === key && "opacity-50",
            )}
          >
            <div className="mb-3 flex items-center gap-2 border-b border-border/70 pb-2.5">
              {customizing && <GripVertical className="size-4 text-muted-foreground" />}
              <h2 className="overline-label">{WIDGETS[key]?.label}</h2>
              {customizing && (
                <div className="ml-auto flex gap-1">
                  <Button size="icon" variant="ghost" className="size-7" disabled={i === 0} onClick={() => moveTo(key, i - 1)} aria-label="Move up"><ArrowUp className="size-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="size-7" disabled={i === layout.length - 1} onClick={() => moveTo(key, i + 1)} aria-label="Move down"><ArrowDown className="size-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => persist(layout.filter((k) => k !== key))} aria-label="Hide widget"><EyeOff className="size-3.5" /></Button>
                </div>
              )}
            </div>
            <Widget id={key} {...ctx} />
          </div>
        ))}
        {!layout.length && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground md:col-span-2">
            <Eye className="mx-auto mb-2 size-5" /> Your dashboard is empty. Click Customize to add widgets.
          </div>
        )}
      </div>
      <TaskDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} task={editing} />
    </div>
  );
}

type Ctx = { tasks: Task[]; courses: Course[]; courseMap: Map<string, Course>; onOpen: (t: Task) => void; weekStartsOn: 0 | 1; fallback: number };

function TaskList({ items, ctx, empty }: { items: Task[]; ctx: Ctx; empty: string }) {
  if (!items.length) return <p className="py-3 text-sm text-muted-foreground">{empty}</p>;
  return <div className="-mx-2">{items.slice(0, 6).map((t) => <TaskRow key={t.id} task={t} course={t.course_id ? ctx.courseMap.get(t.course_id) : undefined} onOpen={ctx.onOpen} compact />)}{items.length > 6 && <Link to="/tasks" className="block px-3 pt-1 text-xs text-primary">+{items.length - 6} more</Link>}</div>;
}

function Widget({ id, ...ctx }: { id: string } & Ctx) {
  const { tasks } = ctx;
  switch (id) {
    case "today": return <TaskList items={tasks.filter((t) => isForToday(t))} ctx={ctx} empty="Nothing planned for today." />;
    case "overdue": return <TaskList items={tasks.filter((t) => isOverdue(t))} ctx={ctx} empty="No overdue work. Nice." />;
    case "upcoming": return <TaskList items={tasks.filter((t) => isUpcoming(t, 7) && !["exam", "quiz"].includes(t.task_type))} ctx={ctx} empty="No deadlines in the next 7 days." />;
    case "exams": return <TaskList items={tasks.filter((t) => isUpcoming(t, 30) && ["exam", "quiz"].includes(t.task_type))} ctx={ctx} empty="No exams in the next 30 days." />;
    case "quickadd": return <QuickCapture />;
    case "workload": return <Workload {...ctx} />;
    case "calendar": return <WeekStrip {...ctx} />;
    case "courses": return <RecentCourses courses={ctx.courses} />;
    case "ai": return (
      <div className="flex items-start gap-3 py-1">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground"><Sparkles className="size-4" /></span>
        <div className="text-sm">
          <p className="font-medium">AI Quick Add — coming in Stage 2</p>
          <p className="text-muted-foreground">Type shorthand like "bio ch 7 test fri" and StudyOS will fill in the course and dates. Not connected yet.</p>
        </div>
      </div>
    );
    default: return null;
  }
}

function QuickCapture() {
  const save = useSave("tasks");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState<"today" | "none">("today");
  return (
    <form className="flex flex-col gap-2 sm:flex-row" onSubmit={async (e) => {
      e.preventDefault();
      if (!title.trim()) return;
      await save.mutateAsync({ title: title.trim().slice(0, 300), planned_date: when === "today" ? toDateKey(new Date()) : null });
      setTitle("");
      toast.success("Captured");
    }}>
      <Input placeholder="Write it down before you forget…" value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 rounded-xl" />
      <div className="flex gap-2">
        <select className="h-11 rounded-xl border border-input bg-background px-2 text-sm" value={when} onChange={(e) => setWhen(e.target.value as "today" | "none")}>
          <option value="today">Work on today</option><option value="none">No date</option>
        </select>
        <Button type="submit" className="h-11 rounded-xl">Add</Button>
      </div>
    </form>
  );
}

function Workload({ tasks, weekStartsOn, fallback }: Ctx) {
  const days = weeklyWorkload(tasks, new Date(), weekStartsOn, fallback);
  const max = Math.max(120, ...days.map((d) => d.minutes));
  return (
    <div className="flex h-36 items-end gap-2 pt-2">
      {days.map((d) => {
        const today = isSameDay(d.day, new Date());
        return (
          <div key={d.key} className="flex flex-1 flex-col items-center gap-1">
            <span className="font-display text-[11px] font-medium text-muted-foreground">{d.minutes ? `${Math.round((d.minutes / 60) * 10) / 10}h` : ""}</span>
            <div className="w-full rounded-md bg-muted" style={{ height: 96 }}>
              <div
                className={cn("w-full rounded-md", d.minutes > 240 ? "bg-destructive" : "bg-primary", !today && "opacity-75")}
                style={{ height: `${(d.minutes / max) * 100}%`, marginTop: `${96 - (d.minutes / max) * 96}px` }}
              />
            </div>
            <span className={cn("text-xs", today ? "font-semibold text-primary" : "text-muted-foreground")}>{format(d.day, "EEEEE")}</span>
          </div>
        );
      })}
    </div>
  );
}

function WeekStrip({ tasks, courseMap, onOpen }: Ctx) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(new Date()), i));
  const byDay = calendarDays(tasks.filter((t) => t.status !== "done"));
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {days.map((d) => {
        const entry = byDay.get(toDateKey(d));
        const today = isSameDay(d, new Date());
        return (
          <div key={d.toISOString()} className={cn("min-h-24 rounded-xl bg-muted/50 p-2", today && "bg-accent/60 ring-1 ring-primary/40")}>
            <p className={cn("text-xs font-medium", today && "font-semibold text-primary")}>{format(d, "EEE d")}</p>
            {!!entry?.dueCount && <p className="font-display text-[11px] font-semibold text-destructive">{entry.dueCount} due</p>}
            <div className="mt-1 space-y-0.5">
              {entry?.work.map((t) => <CalendarTask key={`work-${t.id}`} task={t} course={t.course_id ? courseMap.get(t.course_id) : undefined} onOpen={onOpen} />)}
              {entry?.deadlines.map((t) => <CalendarTask key={`due-${t.id}`} task={t} course={t.course_id ? courseMap.get(t.course_id) : undefined} deadline onOpen={onOpen} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecentCourses({ courses }: { courses: Course[] }) {
  const recent = courses.filter((c) => !c.archived).sort((a, b) => (b.last_accessed_at ?? b.created_at).localeCompare(a.last_accessed_at ?? a.created_at)).slice(0, 4);
  if (!recent.length) return <p className="py-3 text-sm text-muted-foreground">No courses yet. <Link to="/courses" className="text-primary">Add one</Link></p>;
  return (
    <div className="grid grid-cols-2 gap-2">
      {recent.map((c) => (
        <Link key={c.id} to="/courses/$courseId" params={{ courseId: c.id }} className="flex items-center gap-2 rounded-xl border border-border p-2 transition-colors hover:bg-muted/60">
          <span className="grid size-8 place-items-center rounded-lg" style={{ background: `color-mix(in oklab, ${colorVar(c.color)} 16%, transparent)`, color: colorVar(c.color) }}><CourseIcon name={c.icon} className="size-4" /></span>
          <span className="truncate text-sm font-medium">{c.code || c.name}</span>
        </Link>
      ))}
    </div>
  );
}

function Gauge({ value, label, sub, tone }: { value: number; label: string; sub: string; tone?: "warn" | "danger" | undefined }) {
  const id = "g" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const r = 42;
  const c = 2 * Math.PI * r;
  const sweep = (c * 240) / 360;
  const v = Math.max(0, Math.min(1, value));
  const [from, to] = tone === "danger" ? ["var(--destructive)", "var(--destructive)"] : tone === "warn" ? ["var(--warning)", "var(--destructive)"] : ["var(--primary)", "var(--course-pink)"];
  return (
    <div className="flex flex-col items-center">
      <div className="relative size-28">
        <svg viewBox="0 0 100 100" className="size-full" aria-hidden="true">
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={from} />
              <stop offset="1" stopColor={to} />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" className="text-foreground/10" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${sweep} ${c}`} transform="rotate(150 50 50)" />
          <circle cx="50" cy="50" r={r} fill="none" stroke={`url(#${id})`} strokeWidth="6" strokeLinecap="round" opacity={v ? 1 : 0} strokeDasharray={`${sweep * v} ${c}`} transform="rotate(150 50 50)" style={{ transition: "stroke-dasharray 0.6s ease" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center pb-1">
          <span className="font-display text-2xl leading-none">{label}</span>
        </div>
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
