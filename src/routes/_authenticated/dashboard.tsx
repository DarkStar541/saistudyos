import { createFileRoute, Link } from "@tanstack/react-router";
import { useId, useMemo, useState, type ReactNode } from "react";
import { getSavedStyle, type VisualStyle } from "@/lib/theme";
import { addDays, format, startOfDay } from "date-fns";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, GripVertical, Plus, Settings2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { colorVar, useCourses, useFocusSessions, useProfile, useSave, useTasks, type Course, type Task } from "@/lib/db";
import { calendarDays, dateKeyInTimeZone, parsePlanned, isForToday, isOverdue, isUpcoming, todayProgress, toDateKey, uniqueDeadlineTasks, weeklyWorkload } from "@/lib/task-utils";
import { CalendarTask } from "@/components/calendar-task";
import { projectRecurringOccurrences } from "@/lib/recurrence";
import { TaskRow } from "@/components/task-row";
import { TaskDialog } from "@/components/task-dialog";
import { CourseIcon } from "@/components/course-icon";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { QueryState } from "@/components/query-state";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Pace" }, { name: "description", content: "Today's work, deadlines and exams at a glance." }, { property: "og:title", content: "Dashboard — Pace" }, { property: "og:description", content: "Today's work, deadlines and exams at a glance." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
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

function Dashboard() {
  const profileQuery = useProfile();
  const tasksQuery = useTasks();
  const coursesQuery = useCourses();
  const sessionsQuery = useFocusSessions();
  const { data: profile } = profileQuery;
  const { data: tasks = [] } = tasksQuery;
  const { data: courses = [] } = coursesQuery;
  const { data: sessions = [] } = sessionsQuery;
  const saveProfile = useSave("profiles");
  const [customizing, setCustomizing] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [visualStyle] = useState<VisualStyle>(() => getSavedStyle());
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
  const ctx = { tasks, courses, courseMap, onOpen: setEditing, weekStartsOn: (profile?.week_starts_on ?? 1) as 0 | 1, fallback: profile?.default_duration_minutes ?? 60, timeZone: profile?.timezone };

  const metrics = useMemo(() => {
    const now = new Date();
    const todayKey = dateKeyInTimeZone(now, ctx.timeZone);
    return {
      plannedToday: tasks.filter((task) => isForToday(task, now, ctx.timeZone)).length,
      dueThisWeek: uniqueDeadlineTasks(tasks).filter((task) => isUpcoming(task, 7, now, ctx.timeZone)).length,
      overdueCount: uniqueDeadlineTasks(tasks).filter((task) => isOverdue(task, now)).length,
      progressToday: todayProgress(tasks, now, ctx.timeZone),
      focusMin: Math.round(sessions.filter((session) => session.kind === "focus" && dateKeyInTimeZone(new Date(session.started_at), ctx.timeZone) === todayKey).reduce((sum, session) => sum + session.duration_seconds, 0) / 60),
      weekMin: weeklyWorkload(tasks, now, ctx.weekStartsOn, ctx.fallback, ctx.timeZone).reduce((sum, day) => sum + day.minutes, 0),
    };
  }, [tasks, sessions, ctx.timeZone, ctx.weekStartsOn, ctx.fallback]);
  const { plannedToday, dueThisWeek, overdueCount, progressToday, focusMin, weekMin } = metrics;
  const hours = (minutes: number) => `${Math.round((minutes / 60) * 10) / 10}h`;
  const stats: { value: number; label: string; tone?: "danger" | undefined }[] = [
    { value: plannedToday, label: "tasks planned today" },
    { value: dueThisWeek, label: "tasks due this week" },
    { value: overdueCount, label: "overdue tasks", tone: overdueCount ? "danger" : undefined },
  ];
  const queries = [profileQuery, tasksQuery, coursesQuery, sessionsQuery];
  if (queries.some((query) => query.isLoading)) return <QueryState loading loadingLabel="Loading your workspace…" />;
  const queryError = queries.find((query) => query.error)?.error;
  if (queryError) return <QueryState error={queryError} onRetry={() => { void Promise.all(queries.map((query) => query.refetch())); }} />;

  return (
    <div>
      <header className="dashboard-heading mb-8 flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="mr-auto">
          <p className="overline-label">YOUR STUDY SPACE <span className="mx-2 opacity-50">/</span> {format(parsePlanned(dateKeyInTimeZone(new Date(), ctx.timeZone)) ?? new Date(), "EEEE, MMMM d")}</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl">
            {greet}{profile?.display_name ? `, ${profile.display_name.split(" ")[0]}` : ""}
          </h1>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
            {stats.map((s) => (
              <span key={s.label} className="dashboard-stat">
                <span className={cn("font-display text-2xl font-semibold", overdueCount > 0 && s.label === "overdue" ? "text-destructive" : "text-foreground")}>{s.value}</span>
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </span>
            ))}
          </div>
        </div>
        {visualStyle !== "nocturne" && (
          <div className="dashboard-gauge-strip" aria-label="Today's progress and workload">
            <Gauge value={progressToday.completionRatio} label={`${progressToday.completed}/${progressToday.total}`} sub="tasks completed today" />
            <Gauge value={focusMin / 120} label={focusMin >= 60 ? hours(focusMin) : `${focusMin}m`} sub="focus today · 2h goal" />
            <Gauge value={weekMin / 1200} label={hours(weekMin)} sub="scheduled time this week" />
          </div>
        )}
        <Button variant={customizing ? "default" : "outline"} size="sm" onClick={() => setCustomizing((c) => !c)}>
          {customizing ? <><Check className="size-4" /> Done</> : <><Settings2 className="size-4" /> Customize</>}
        </Button>
      </header>

      {visualStyle === "nocturne" && <NocturneControlDeck tasks={tasks} courses={courses} />}

      {customizing && hidden.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border p-3 text-sm">
          <span className="text-muted-foreground">Add widget:</span>
          {hidden.map((k) => <Button key={k} size="sm" variant="secondary" onClick={() => persist([...layout, k])}><Plus className="size-3.5" /> {WIDGETS[k]?.label}</Button>)}
        </div>
      )}

      {layout.length ? (
        <DashboardComposition
          style={visualStyle}
          ctx={ctx}
          layout={layout}
          customizing={customizing}
          dragKey={dragKey}
          setDragKey={setDragKey}
          moveTo={moveTo}
          persist={persist}
          renderWidget={(key, index) => (
            <div
              key={key}
              data-widget={key}
              style={
                visualStyle === "nocturne" &&
                ["upcoming", "exams", "quickadd", "calendar", "ai"].includes(key)
                  ? { gridColumn: "1 / -1" }
                  : undefined
              }
              draggable={customizing}
              onDragStart={() => setDragKey(key)}
              onDragOver={(e) => customizing && e.preventDefault()}
              onDrop={() => { if (dragKey && dragKey !== key) moveTo(dragKey, index); setDragKey(null); }}
              className={cn(
                "dashboard-widget relative transition-shadow",
                visualStyle === "nocturne" && ["upcoming", "exams"].includes(key) && "nocturne-widget-wide",
                !customizing && "hover:shadow-lift",
                customizing && "cursor-move ring-1 ring-primary/30",
                dragKey === key && "opacity-50",
              )}
            >
              <div className="dashboard-widget-heading mb-3 flex items-center gap-2 border-b border-border/70 pb-2.5">
                {customizing && <GripVertical className="size-4 text-muted-foreground" />}
                <h2 className="overline-label">{WIDGETS[key]?.label}</h2>
                {customizing && (
                  <div className="ml-auto flex gap-1">
                    <Button size="icon" variant="ghost" className="size-7" disabled={index === 0} onClick={() => moveTo(key, index - 1)} aria-label="Move up"><ArrowUp className="size-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="size-7" disabled={index === layout.length - 1} onClick={() => moveTo(key, index + 1)} aria-label="Move down"><ArrowDown className="size-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => persist(layout.filter((k) => k !== key))} aria-label="Hide widget"><EyeOff className="size-3.5" /></Button>
                  </div>
                )}
              </div>
              <Widget id={key} {...ctx} />
            </div>
          )}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          <Eye className="mx-auto mb-2 size-5" /> Your dashboard is empty. Click Customize to add widgets.
        </div>
      )}
      {editing && <TaskDialog open={true} onOpenChange={(o) => !o && setEditing(null)} task={editing} />}
    </div>
  );
}


type DashboardCompositionProps = {
  style: VisualStyle;
  ctx: Ctx;
  layout: string[];
  customizing: boolean;
  dragKey: string | null;
  setDragKey: (key: string | null) => void;
  moveTo: (key: string, index: number) => void;
  persist: (next: string[]) => void;
  renderWidget: (key: string, index: number) => ReactNode;
};

function DashboardComposition(props: DashboardCompositionProps) {
  const { style, layout, renderWidget, ctx } = props;
  const indexOf = (key: string) => layout.indexOf(key);
  const card = (key: string) => indexOf(key) >= 0 ? renderWidget(key, indexOf(key)) : null;
  const group = (keys: string[], className: string) => (
    <div className={className}>{keys.filter((key) => layout.includes(key)).map((key) => card(key))}</div>
  );

  // Keep the existing widget manager available in Customize mode.
  // The normal view returns to each style's bespoke dashboard composition.
  if (props.customizing) {
    return <div className="dashboard-customize-layout">{layout.map((key) => card(key))}</div>;
  }

  // Every theme composes the same user-managed widget set. The visual language
  // and placement differ by theme, but hidden widgets stay hidden and saved order
  // remains the source of truth in both normal and Customize views.
  const themeLayoutClass = {
    evergreen: "evergreen-widget-layout",
    "paper-ink": "paper-widget-layout",
    nocturne: "nocturne-widget-grid",
    daydream: "daydream-widget-layout",
    "ember-aurora": "ember-widget-layout",
  }[style];

  return (
    <div className={cn("dashboard-composition theme-widget-layout", themeLayoutClass)}>
      {layout.map((key) => card(key))}
    </div>
  );
}

function PaperEditionDashboard({ ctx }: { ctx: Ctx }) {
  const open = ctx.tasks.filter((t) => t.status !== "done");
  const today = open.filter((task) => isForToday(task, new Date(), ctx.timeZone));
  const overdue = open.filter((task) => isOverdue(task));
  const next = open.filter((t) => isUpcoming(t, 14, new Date(), ctx.timeZone)).sort((a,b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""));
  const lead = next[0] ?? today[0];
  return (
    <section className="paper-edition" aria-label="Daily academic edition">
      <div className="paper-edition-masthead"><span>THE PACE REVIEW</span><span>{format(new Date(),"EEEE · MMMM d, yyyy")}</span><span>VOL. 01 / DAILY</span></div>
      <div className="paper-edition-title"><span>YOUR ACADEMIC DAILY</span><h2>Today, in focus.</h2><p>A clear account of what matters, what is next, and what can wait.</p></div>
      <div className="paper-edition-grid">
        <aside className="paper-edition-brief">
          <span className="paper-edition-label">THE BRIEF</span>
          <strong>{String(today.length).padStart(2,"0")}</strong><p>items on today's agenda</p>
          <hr/><strong>{String(overdue.length).padStart(2,"0")}</strong><p>items requiring attention</p>
          <hr/><strong>{String(ctx.courses.filter(c=>!c.archived).length).padStart(2,"0")}</strong><p>active courses</p>
        </aside>
        <article className="paper-edition-lead">
          <span className="paper-edition-label">LEAD STORY / NEXT DEADLINE</span>
          {lead ? <><h3>{lead.title}</h3><p>{ctx.courseMap.get(lead.course_id ?? "")?.name ?? "Independent work"} · {lead.due_at ? format(new Date(lead.due_at),"EEEE, MMMM d · h:mm a") : "No due time recorded"}</p><button onClick={()=>ctx.onOpen(lead)}>Open assignment ↗</button></> : <><h3>Room to think.</h3><p>No immediate deadlines are on the horizon. Use the space to get ahead.</p></>}
        </article>
        <div className="paper-edition-column"><span className="paper-edition-label">TODAY'S REGISTER</span>{today.length ? today.slice(0,5).map(t=><button className="paper-edition-line" key={t.id} onClick={()=>ctx.onOpen(t)}><span>{t.title}</span><small>{ctx.courseMap.get(t.course_id ?? "")?.code ?? "PERSONAL"}</small></button>) : <p className="paper-edition-empty">No planned work today.</p>}</div>
        <div className="paper-edition-column"><span className="paper-edition-label">COMING UP</span>{next.slice(0,5).map(t=><button className="paper-edition-line" key={t.id} onClick={()=>ctx.onOpen(t)}><span>{t.title}</span><small>{t.due_at ? format(new Date(t.due_at),"MMM d") : "UNDATED"}</small></button>)}{!next.length&&<p className="paper-edition-empty">No upcoming deadlines.</p>}</div>
      </div>
      <div className="paper-edition-footer"><span>QUICK NOTE</span><QuickCapture /><span>END OF BRIEFING</span></div>
    </section>
  );
}

function DaydreamDashboard({ ctx }: { ctx: Ctx }) {
  const open=ctx.tasks.filter(t=>t.status!=="done");
  const today=open.filter((task) => isForToday(task, new Date(), ctx.timeZone));
  const upcoming=open.filter(t=>isUpcoming(t,7,new Date(),ctx.timeZone)).sort((a,b)=>(a.due_at??"").localeCompare(b.due_at??""));
  const progress = todayProgress(ctx.tasks, new Date(), ctx.timeZone);
  const pct = Math.round(progress.completionRatio * 100);
  const todayKey = dateKeyInTimeZone(new Date(), ctx.timeZone);
  const [year, month, day] = todayKey.split("-").map(Number);
  const todayDate = new Date(year, month - 1, day);
  const days=Array.from({length:7},(_,i)=>addDays(startOfDay(todayDate),i));
  return (
    <section className="daydream-dashboard" aria-label="Creative study dashboard">
      <div className="daydream-welcome"><div><span className="daydream-sticker">TODAY'S PROGRESS</span><h2>Make today<br/><em>count.</em></h2><p>Your week is yours to shape. Pick a starting point and build some momentum.</p></div><div className="daydream-progress-orbit"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="48"/><circle className="daydream-progress-ring" cx="60" cy="60" r="48" style={{strokeDasharray:`${pct/100*302} 302`}}/></svg><strong>{pct}%</strong><span>completed today</span></div></div>
      <div className="daydream-week"><div className="daydream-section-title"><span>YOUR WEEK, IN COLOR</span><small>7 DAY VIEW</small></div><div className="daydream-day-row">{days.map((day,i)=>{const count=open.filter(t=>t.due_at&&dateKeyInTimeZone(new Date(t.due_at),ctx.timeZone)===toDateKey(day)).length;return <div className={cn("daydream-day",i===0&&"is-today")} key={day.toISOString()}><small>{format(day,"EEE")}</small><strong>{format(day,"d")}</strong><i style={{transform:`scaleX(${Math.min(1,count/4)})`}}/><span>{count||"—"}</span></div>})}</div></div>
      <div className="daydream-board"><div className="daydream-board-main"><div className="daydream-section-title"><span>START HERE</span><small>{today.length} ON YOUR LIST</small></div>{today.length?today.slice(0,4).map((t,i)=><button key={t.id} className={`daydream-task-card daydream-task-${i%4}`} onClick={()=>ctx.onOpen(t)}><span>{ctx.courseMap.get(t.course_id??"")?.code??"PERSONAL"}</span><strong>{t.title}</strong><small>Open task ↗</small></button>):<div className="daydream-empty">Your slate is clear. Add something you want to make progress on.</div>}</div><aside className="daydream-next"><div className="daydream-section-title"><span>ON THE HORIZON</span></div>{upcoming.slice(0,5).map(t=><button key={t.id} onClick={()=>ctx.onOpen(t)}><span>{t.due_at?format(new Date(t.due_at),"MMM d"):"Anytime"}</span><strong>{t.title}</strong></button>)}{!upcoming.length&&<p>Nothing due soon. Enjoy the breathing room.</p>}</aside></div>
      <div className="daydream-capture"><span>DON'T LOSE THE IDEA</span><QuickCapture /></div>
    </section>
  );
}

function EmberAuroraDashboard({ ctx }: { ctx: Ctx }) {
  const open=ctx.tasks.filter(t=>t.status!=="done");
  const today=open.filter((task) => isForToday(task, new Date(), ctx.timeZone));
  const upcoming=open.filter(t=>isUpcoming(t,14)).sort((a,b)=>(a.due_at??"").localeCompare(b.due_at??"")).slice(0,6);
  const done=ctx.tasks.length-open.length;
  const pct=ctx.tasks.length?Math.round(done/ctx.tasks.length*100):0;
  return (
    <section className="ember-aurora-dashboard" aria-label="Aurora workspace">
      <div className="ember-aurora-surface">
        <div className="ember-aurora-copy"><span>YOUR SPACE / A MOMENT TO RESET</span><h2>Find your<br/><i>flow.</i></h2><p>A calm overview of your academic world, with the next right thing close at hand.</p><div className="ember-aurora-actions"><span>{today.length} things planned today</span><span>{upcoming.length} approaching</span></div></div>
        <div className="ember-aurora-orbit"><div className="ember-orbit orbit-one"/><div className="ember-orbit orbit-two"/><div className="ember-orbit-core"><strong>{pct}%</strong><span>completed</span></div></div>
      </div>
      <div className="ember-aurora-layout">
        <main className="ember-aurora-timeline"><div className="ember-aurora-heading"><span>THE NEXT FEW STEPS</span><small>YOUR TIMELINE</small></div>{upcoming.length?upcoming.map((t,i)=><button className="ember-timeline-item" key={t.id} onClick={()=>ctx.onOpen(t)}><i/><time>{t.due_at?format(new Date(t.due_at),"MMM d · h:mm a"):"FLEXIBLE"}</time><strong>{t.title}</strong><small>{ctx.courseMap.get(t.course_id??"")?.name??"Personal work"}</small></button>):<p className="ember-aurora-empty">Your timeline is open. Add a task whenever you're ready.</p>}</main>
        <aside className="ember-aurora-side"><div className="ember-aurora-glass-card"><span>ACTIVE COURSES</span><strong>{ctx.courses.filter(c=>!c.archived).length.toString().padStart(2,"0")}</strong><div className="ember-course-cloud">{ctx.courses.filter(c=>!c.archived).slice(0,6).map(course=><span key={course.id}>{course.code||course.name}</span>)}</div></div><div className="ember-aurora-glass-card"><span>TODAY'S FOCUS</span><strong>{today.length.toString().padStart(2,"0")}</strong><p>{today[0]?.title??"A little room to get ahead."}</p></div><div className="ember-aurora-quick"><span>CAPTURE A THOUGHT</span><QuickCapture /></div></aside>
      </div>
    </section>
  );
}

function NocturneControlDeck({ tasks, courses }: { tasks: Task[]; courses: Course[] }) {
  const openTasks = tasks.filter((task) => task.status !== "done");
  const todayKey = toDateKey(new Date());
  const progress = todayProgress(tasks);
  const completedToday = progress.completed;
  const planned = progress.remaining;
  const todayTotal = progress.total;
  const dueSoon = openTasks.filter((task) => isUpcoming(task, 7)).length;
  const overdue = openTasks.filter((task) => isOverdue(task)).length;
  const completion = Math.round(progress.completionRatio * 100);
  const activeCourses = courses.filter((course) => !course.archived).length;
  // Radar tracks planned work sessions first; actual deadline is the fallback
  // for tasks that do not have a separate work-on date.
  const radarEnd = toDateKey(addDays(startOfDay(new Date()), 30));
  const radarItems = openTasks
    .map((task) => ({
      task,
      workDate: task.planned_date ?? (task.due_at ? toDateKey(new Date(task.due_at)) : null),
    }))
    .filter((item) => !!item.workDate && item.workDate >= todayKey && item.workDate <= radarEnd)
    .sort((a, b) => (a.workDate ?? "").localeCompare(b.workDate ?? ""))
    .slice(0, 5);

  return (
    <section className="nocturne-control-deck" aria-label="Academic operations control center">
      <div className="nocturne-console-topline">
        <div>
          <p className="nocturne-eyebrow">PACE / OPERATIONS</p>
          <h2>Control center<span>_</span></h2>
          <p className="nocturne-console-subtitle">A live overview of your academic workload.</p>
        </div>
        <div className="nocturne-system-status"><i /> SYSTEM ONLINE <span>LOCAL DATA</span></div>
      </div>

      <div className="nocturne-instrument-grid">
        <InstrumentGauge label="Completion today" value={`${completion}%`} detail={`${completedToday} of ${todayTotal} today`} ratio={completion / 100} tone="gold" />
        <InstrumentGauge label="Today's queue" value={String(planned)} detail="remaining today" ratio={progress.remainingRatio} tone="blue" />
        <InstrumentGauge label="Due soon" value={String(dueSoon)} detail="next 7 days" ratio={openTasks.length ? dueSoon / openTasks.length : 0} tone="teal" />
        <InstrumentGauge label="Overdue" value={String(overdue)} detail="open items" ratio={openTasks.length ? overdue / openTasks.length : 0} tone="alert" />
        <div className="nocturne-course-instrument">
          <div className="nocturne-panel-heading"><span>COURSE NETWORK</span><span>ACTIVE</span></div>
          <div className="nocturne-course-value">{activeCourses.toString().padStart(2, "0")}<small> COURSES</small></div>
          <div className="nocturne-course-track">{courses.filter((course) => !course.archived).slice(0, 8).map((course) => <i key={course.id} title={course.code || course.name} />)}</div>
          <p>Active courses in your workspace</p>
        </div>
      </div>

      <div className="nocturne-deadline-panel">
        <div className="nocturne-panel-heading"><span>WORK SESSION RADAR</span><span>NEXT 30 DAYS</span></div>
        {radarItems.length ? (
          <div className="nocturne-deadline-list">
            {radarItems.map(({ task, workDate }, index) => (
              <div className="nocturne-deadline-row" key={task.id}>
                <span className="nocturne-radar-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="nocturne-radar-dot" />
                <span className="nocturne-deadline-name">{task.title}</span>
                <span className="nocturne-deadline-type">{task.task_type}</span>
                <time>{format(new Date(workDate + "T12:00:00"), "MMM d")}{task.due_at && task.planned_date ? " · deadline " + format(new Date(task.due_at), "MMM d") : ""}</time>
              </div>
            ))}
          </div>
        ) : (
          <p className="nocturne-empty-radar">No planned work sessions in the next 30 days.</p>
        )}
      </div>
    </section>
  );
}

function InstrumentGauge({ label, value, detail, ratio, tone }: { label: string; value: string; detail: string; ratio: number; tone: "gold" | "blue" | "teal" | "alert" }) {
  const circumference = 2 * Math.PI * 39;
  const progress = Math.max(0, Math.min(1, ratio));
  return (
    <div className={`nocturne-gauge nocturne-gauge-${tone}`}>
      <div className="nocturne-gauge-top"><span>{label}</span><span className="nocturne-gauge-live">LIVE</span></div>
      <div className="nocturne-gauge-body">
        <svg viewBox="0 0 100 100" role="img" aria-label={`${label}: ${value}`}>
          <circle className="nocturne-gauge-track" cx="50" cy="50" r="39" />
          <circle className="nocturne-gauge-progress" cx="50" cy="50" r="39" strokeDasharray={`${progress * circumference} ${circumference}`} />
        </svg>
        <div className="nocturne-gauge-reading"><strong>{value}</strong><span>{detail}</span></div>
      </div>
    </div>
  );
}

type Ctx = { tasks: Task[]; courses: Course[]; courseMap: Map<string, Course>; onOpen: (t: Task) => void; weekStartsOn: 0 | 1; fallback: number; timeZone?: string };

function TaskList({ items, ctx, empty }: { items: Task[]; ctx: Ctx; empty: string }) {
  if (!items.length) return <p className="py-3 text-sm text-muted-foreground">{empty}</p>;
  return <div className="-mx-2">{items.slice(0, 6).map((t) => <TaskRow key={t.id} task={t} course={t.course_id ? ctx.courseMap.get(t.course_id) : undefined} onOpen={ctx.onOpen} compact />)}{items.length > 6 && <Link to="/tasks" className="block px-3 pt-1 text-xs text-primary">+{items.length - 6} more</Link>}</div>;
}

function Widget({ id, ...ctx }: { id: string } & Ctx) {
  const { tasks } = ctx;
  switch (id) {
    case "today": return <TaskList items={tasks.filter((t) => isForToday(t, new Date(), ctx.timeZone))} ctx={ctx} empty="Nothing planned for today." />;
    case "overdue": return <TaskList items={tasks.filter((t) => isOverdue(t))} ctx={ctx} empty="No overdue work. Nice." />;
    case "upcoming": return <TaskList items={uniqueDeadlineTasks(tasks).filter((t) => isUpcoming(t, 7, new Date(), ctx.timeZone) && !["exam", "quiz"].includes(t.task_type))} ctx={ctx} empty="No deadlines in the next 7 days." />;
    case "exams": return <TaskList items={uniqueDeadlineTasks(tasks).filter((t) => isUpcoming(t, 30, new Date(), ctx.timeZone) && ["exam", "quiz"].includes(t.task_type))} ctx={ctx} empty="No exams in the next 30 days." />;
    case "quickadd": return <QuickCapture />;
    case "workload": return <Workload {...ctx} />;
    case "calendar": return <WeekStrip {...ctx} />;
    case "courses": return <RecentCourses courses={ctx.courses} />;
    case "ai": return (
      <div className="flex items-start gap-3 py-1">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground"><Sparkles className="size-4" /></span>
        <div className="text-sm">
          <p className="font-medium">AI Quick Add — coming in Stage 2</p>
          <p className="text-muted-foreground">Type shorthand like "bio ch 7 test fri" and Pace will fill in the course and dates. Not connected yet.</p>
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
        <Select value={when} onValueChange={(value) => setWhen(value as "today" | "none")}>
          <SelectTrigger className="h-11 w-40 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="today">Work on today</SelectItem><SelectItem value="none">No date</SelectItem></SelectContent>
        </Select>
        <Button type="submit" className="h-11 rounded-xl">Add</Button>
      </div>
    </form>
  );
}

function Workload({ tasks, weekStartsOn, fallback, timeZone }: Ctx) {
  const days = weeklyWorkload(tasks, new Date(), weekStartsOn, fallback, timeZone);
  const todayKey = dateKeyInTimeZone(new Date(), timeZone);
  const max = Math.max(120, ...days.map((d) => d.minutes));
  return (
    <div className="flex h-36 items-end gap-2 pt-2">
      {days.map((d) => {
        const today = d.key === todayKey;
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

function WeekStrip({ tasks, courseMap, onOpen, timeZone }: Ctx) {
  const todayKey = dateKeyInTimeZone(new Date(), timeZone);
  const [year, month, day] = todayKey.split("-").map(Number);
  const todayDate = new Date(year, month - 1, day);
  const days = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(todayDate), i));
  const byDay = calendarDays(tasks.filter((t) => t.status !== "done"), timeZone);
  const projected = projectRecurringOccurrences(tasks, days[0] ?? new Date(), days[days.length - 1] ?? new Date(), new Date(), timeZone);
  const projectedByDay = new Map<string, typeof projected>();
  for (const occurrence of projected) {
    const bucket = projectedByDay.get(occurrence.planned_date) ?? [];
    bucket.push(occurrence);
    projectedByDay.set(occurrence.planned_date, bucket);
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {days.map((d) => {
        const entry = byDay.get(toDateKey(d));
        const today = toDateKey(d) === todayKey;
        return (
          <div key={d.toISOString()} className={cn("min-h-24 rounded-xl bg-muted/50 p-2", today && "bg-accent/60 ring-1 ring-primary/40")}>
            <p className={cn("text-xs font-medium", today && "font-semibold text-primary")}>{format(d, "EEE d")}</p>
            {!!entry?.dueCount && <p className="font-display text-[11px] font-semibold text-destructive">{entry.dueCount} due</p>}
            <div className="mt-1 space-y-0.5">
              {entry?.work.map((t) => <CalendarTask key={`work-${t.id}`} task={t} course={t.course_id ? courseMap.get(t.course_id) : undefined} onOpen={onOpen} />)}
              {(projectedByDay.get(toDateKey(d)) ?? []).map(({ task, planned_date }) => (
                <button key={`projected-${task.id}-${planned_date}`} type="button" onClick={() => onOpen(task)} title="Projected recurring work — opens the series" className="projected-work-chip">
                  <span aria-hidden="true">↻</span><span className="truncate">{task.title}</span>
                </button>
              ))}
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

function Gauge({ value, label, sub }: { value: number; label: string; sub: string }) {
  const id = "g" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const sweep = (circumference * 240) / 360;
  const progress = Math.max(0, Math.min(1, value));
  return (
    <div className="dashboard-summary-gauge">
      <div className="dashboard-summary-gauge-dial">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--primary)" /><stop offset="1" stopColor="var(--course-teal)" /></linearGradient></defs>
          <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" className="text-foreground/10" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${sweep} ${circumference}`} transform="rotate(150 50 50)" />
          <circle cx="50" cy="50" r={radius} fill="none" stroke={`url(#${id})`} strokeWidth="6" strokeLinecap="round" opacity={progress ? 1 : 0} strokeDasharray={`${sweep * progress} ${circumference}`} transform="rotate(150 50 50)" />
        </svg>
        <strong>{label}</strong>
      </div>
      <span>{sub}</span>
    </div>
  );
}
