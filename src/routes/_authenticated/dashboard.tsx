import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, GripVertical, Plus, Settings2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { colorVar, useCourses, useProfile, useSave, useTasks, type Course, type Task } from "@/lib/db";
import { isForToday, isOverdue, isUpcoming, toDateKey, weeklyWorkload, workDay } from "@/lib/task-utils";
import { TaskRow } from "@/components/task-row";
import { TaskDialog } from "@/components/task-dialog";
import { CourseIcon } from "@/components/course-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — StudyOS" }, { name: "description", content: "Today's work, deadlines and exams at a glance." }] }),
  component: Dashboard,
});

export const WIDGETS: Record<string, { label: string; wide?: boolean }> = {
  quickadd: { label: "Quick capture", wide: true },
  today: { label: "Today" },
  overdue: { label: "Overdue" },
  upcoming: { label: "Upcoming assignments" },
  exams: { label: "Upcoming exams" },
  calendar: { label: "This week" , wide: true },
  workload: { label: "Weekly workload" },
  courses: { label: "Recent courses" },
  ai: { label: "AI assistant" },
};

function Dashboard() {
  const { data: profile } = useProfile();
  const { data: tasks = [] } = useTasks();
  const { data: courses = [] } = useCourses();
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

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM d")}</p>
          <h1 className="text-3xl font-bold">{greet}{profile?.display_name ? `, ${profile.display_name.split(" ")[0]}` : ""}</h1>
        </div>
        <Button variant={customizing ? "default" : "outline"} size="sm" onClick={() => setCustomizing((c) => !c)}>
          {customizing ? <><Check className="size-4" /> Done</> : <><Settings2 className="size-4" /> Customize</>}
        </Button>
      </div>

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
            className={cn("relative rounded-2xl border border-border bg-card p-4 shadow-card", WIDGETS[key]?.wide && "md:col-span-2", customizing && "cursor-move ring-1 ring-primary/30", dragKey === key && "opacity-50")}
          >
            <div className="mb-2 flex items-center gap-2">
              {customizing && <GripVertical className="size-4 text-muted-foreground" />}
              <h2 className="text-sm font-semibold">{WIDGETS[key]?.label}</h2>
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
      <Input placeholder="Write it down before you forget…" value={title} onChange={(e) => setTitle(e.target.value)} className="h-10" />
      <div className="flex gap-2">
        <select className="h-10 rounded-md border border-input bg-background px-2 text-sm" value={when} onChange={(e) => setWhen(e.target.value as "today" | "none")}>
          <option value="today">Work on today</option><option value="none">No date</option>
        </select>
        <Button type="submit" className="h-10">Add</Button>
      </div>
    </form>
  );
}

function Workload({ tasks, weekStartsOn, fallback }: Ctx) {
  const days = weeklyWorkload(tasks, new Date(), weekStartsOn, fallback);
  const max = Math.max(120, ...days.map((d) => d.minutes));
  return (
    <div className="flex h-36 items-end gap-2 pt-2">
      {days.map((d) => (
        <div key={d.key} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] text-muted-foreground">{d.minutes ? `${Math.round((d.minutes / 60) * 10) / 10}h` : ""}</span>
          <div className="w-full rounded-md bg-muted" style={{ height: 96 }}>
            <div className={cn("w-full rounded-md", d.minutes > 240 ? "bg-destructive" : "bg-primary")} style={{ height: `${(d.minutes / max) * 100}%`, marginTop: `${96 - (d.minutes / max) * 96}px` }} />
          </div>
          <span className={cn("text-xs", isSameDay(d.day, new Date()) ? "font-semibold text-primary" : "text-muted-foreground")}>{format(d.day, "EEEEE")}</span>
        </div>
      ))}
    </div>
  );
}

function WeekStrip({ tasks, courseMap, onOpen }: Ctx) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(new Date()), i));
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {days.map((d) => {
        const items = tasks.filter((t) => t.status !== "done" && (() => { const w = workDay(t); return w && isSameDay(w, d); })());
        const deadlines = tasks.filter((t) => t.status !== "done" && t.due_at && isSameDay(new Date(t.due_at), d));
        return (
          <div key={d.toISOString()} className="min-h-24 rounded-xl bg-muted/50 p-2">
            <p className={cn("text-xs font-medium", isSameDay(d, new Date()) && "text-primary")}>{format(d, "EEE d")}</p>
            {!!deadlines.length && <p className="text-[10px] font-semibold text-destructive">{deadlines.length} due</p>}
            <div className="mt-1 space-y-0.5">
              {items.slice(0, 3).map((t) => {
                const c = t.course_id ? courseMap.get(t.course_id) : undefined;
                return <button key={t.id} onClick={() => onOpen(t)} className="block w-full truncate rounded px-1 text-left text-xs" style={{ background: `color-mix(in oklab, ${c ? colorVar(c.color) : "var(--primary)"} 18%, transparent)` }}>{t.title}</button>;
              })}
              {items.length > 3 && <p className="text-[10px] text-muted-foreground">+{items.length - 3}</p>}
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
        <Link key={c.id} to="/courses/$courseId" params={{ courseId: c.id }} className="flex items-center gap-2 rounded-xl border border-border p-2 hover:bg-muted/60">
          <span className="grid size-8 place-items-center rounded-lg" style={{ background: `color-mix(in oklab, ${colorVar(c.color)} 16%, transparent)`, color: colorVar(c.color) }}><CourseIcon name={c.icon} className="size-4" /></span>
          <span className="truncate text-sm font-medium">{c.code || c.name}</span>
        </Link>
      ))}
    </div>
  );
}
