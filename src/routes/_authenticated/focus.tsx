import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Coffee, Play, Square, Target, Timer, Zap } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCourses, useFocusSessions, useProfile, useTasks, type FocusSession } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/focus")({
  head: () => ({ meta: [{ title: "Focus — StudyOS" }, { name: "description", content: "A focused study timer with session history." }] }),
  component: FocusPage,
});

type Mode = "focus" | "short_break" | "long_break";
const NONE = "__none__";
const modeLabel: Record<Mode, string> = { focus: "Focus", short_break: "Short break", long_break: "Long break" };

function FocusPage() {
  const { data: profile } = useProfile();
  const { data: tasks = [] } = useTasks();
  const { data: courses = [] } = useCourses();
  const { data: sessions = [], isLoading } = useFocusSessions();
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("focus");
  const [taskId, setTaskId] = useState("");
  const [active, setActive] = useState<FocusSession | null>(null);
  const [now, setNow] = useState(Date.now());
  const hydrated = useRef(false);
  const finishing = useRef<string | null>(null);

  const minutes = mode === "focus" ? profile?.focus_minutes ?? 25 : mode === "short_break" ? profile?.short_break_minutes ?? 5 : profile?.long_break_minutes ?? 15;
  const plannedSeconds = Math.max(60, minutes * 60);
  const elapsed = active ? Math.max(0, Math.floor((now - new Date(active.started_at).getTime()) / 1000)) : 0;
  const remaining = active ? Math.max(0, active.planned_seconds - elapsed) : plannedSeconds;
  const progress = active ? Math.min(1, elapsed / Math.max(1, active.planned_seconds)) : 0;
  const selectedTask = tasks.find((task) => task.id === taskId);
  const selectedCourseId = selectedTask?.course_id ?? null;

  useEffect(() => {
    if (isLoading || hydrated.current) return;
    hydrated.current = true;
    const open = sessions.find((session) => !session.ended_at);
    if (open) {
      setActive(open);
      setMode(open.kind === "short_break" || open.kind === "long_break" ? open.kind : "focus");
      setTaskId(open.task_id ?? "");
    }
  }, [isLoading, sessions]);

  useEffect(() => {
    if (!active) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [active?.id]);

  useEffect(() => {
    if (!active || remaining > 0 || finishing.current === active.id) return;
    finishing.current = active.id;
    const finish = async () => {
      const endedAt = new Date().toISOString();
      const { error } = await supabase.from("focus_sessions").update({
        ended_at: endedAt,
        duration_seconds: active.planned_seconds,
        completed: true,
      }).eq("id", active.id);
      if (error) {
        finishing.current = null;
        toast.error(error.message);
        return;
      }
      setActive(null);
      finishing.current = null;
      await qc.invalidateQueries({ queryKey: ["focus_sessions"] });
      toast.success(modeLabel[active.kind as Mode] + " session complete");
    };
    void finish();
  }, [active, remaining, qc]);

  const recent = useMemo(() => sessions.filter((s) => s.ended_at && s.kind === "focus").slice(0, 6), [sessions]);
  const todaySeconds = sessions
    .filter((s) => s.kind === "focus" && new Date(s.started_at).toDateString() === new Date().toDateString())
    .reduce((sum, s) => sum + (s.ended_at ? s.duration_seconds : elapsed), 0);
  const formatTime = (seconds: number) => {
    const safe = Math.max(0, seconds);
    return `${String(Math.floor(safe / 3600)).padStart(2, "0") ? Math.floor(safe / 60).toString().padStart(2, "0") : "00"}:${String(safe % 60).padStart(2, "0")}`;
  };

  async function start() {
    if (!profile || active) return;
    const startedAt = new Date().toISOString();
    const { data, error } = await supabase.from("focus_sessions").insert({
      user_id: profile.id,
      kind: mode,
      planned_seconds: plannedSeconds,
      duration_seconds: 0,
      completed: false,
      started_at: startedAt,
      task_id: mode === "focus" ? taskId || null : null,
      course_id: mode === "focus" ? selectedCourseId : null,
    }).select().single();
    if (error) return void toast.error(error.message);
    setNow(Date.now());
    setActive(data as FocusSession);
    await qc.invalidateQueries({ queryKey: ["focus_sessions"] });
  }

  async function stop() {
    if (!active || finishing.current === active.id) return;
    finishing.current = active.id;
    const endedAt = new Date().toISOString();
    const duration = Math.min(active.planned_seconds, Math.max(0, Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000)));
    const { error } = await supabase.from("focus_sessions").update({
      ended_at: endedAt,
      duration_seconds: duration,
      completed: false,
    }).eq("id", active.id);
    finishing.current = null;
    if (error) return void toast.error(error.message);
    setActive(null);
    await qc.invalidateQueries({ queryKey: ["focus_sessions"] });
    toast("Session saved");
  }

  const mmss = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  const todayMinutes = Math.round(todaySeconds / 60);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="page-intro mb-8 border-b border-border/70 pb-6">
        <p className="overline-label mb-2">PROTECT YOUR ATTENTION</p>
        <h1 className="text-5xl font-semibold">Focus<span className="text-primary">.</span></h1>
        <p className="mt-2 text-sm text-muted-foreground">One session. One priority. No noise.</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <section className="rounded-3xl border border-border bg-card p-6 text-center shadow-card sm:p-9">
          <div className="mb-7 flex flex-wrap justify-center gap-2">
            {(["focus", "short_break", "long_break"] as Mode[]).map((m) => (
              <Button key={m} variant={mode === m ? "default" : "outline"} size="sm" disabled={!!active} onClick={() => setMode(m)}>
                {m === "focus" ? <Target className="mr-1.5 size-4" /> : <Coffee className="mr-1.5 size-4" />}{modeLabel[m]}
              </Button>
            ))}
          </div>
          <div className="mx-auto grid size-64 place-items-center rounded-full p-3 sm:size-72" style={{ background: `conic-gradient(var(--primary) ${progress * 360}deg, hsl(var(--muted)) 0deg)` }}>
            <div className="grid size-full place-items-center rounded-full bg-card">
              <div>
                <p className="overline-label">{active ? "SESSION IN PROGRESS" : modeLabel[mode].toUpperCase()}</p>
                <p className="mt-2 font-display text-6xl font-semibold tabular-nums tracking-tight">{mmss}</p>
                <p className="mt-2 text-xs text-muted-foreground">{active ? "Elapsed time is tracked from the saved start timestamp" : `${minutes} minute session`}</p>
              </div>
            </div>
          </div>
          <div className="mx-auto mt-7 max-w-md space-y-3">
            <div className="text-left">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">FOCUS TASK (OPTIONAL)</label>
              <Select value={taskId || NONE} onValueChange={(v) => setTaskId(v === NONE ? "" : v)} disabled={!!active || mode !== "focus"}>
                <SelectTrigger><SelectValue placeholder="Choose a task" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No linked task</SelectItem>
                  {tasks.filter((task) => task.status !== "done").map((task) => <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {selectedTask && <p className="text-left text-xs text-muted-foreground">{courses.find((course) => course.id === selectedTask.course_id)?.name ?? "Personal work"}</p>}
            {active ? (
              <Button className="w-full" variant="outline" onClick={stop}><Square className="mr-2 size-4" /> End session</Button>
            ) : (
              <Button className="w-full" onClick={start}><Play className="mr-2 size-4" /> Start {modeLabel[mode].toLowerCase()}</Button>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 text-sm font-semibold"><Zap className="size-4 text-primary" /> Today's focus</div>
            <p className="mt-4 font-display text-4xl font-semibold tabular-nums">{todayMinutes}<span className="ml-1 text-base font-normal text-muted-foreground">min</span></p>
            <p className="mt-1 text-xs text-muted-foreground">Recorded focus time today</p>
          </section>
          <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold"><Timer className="size-4 text-primary" /> Recent sessions</div>
            {recent.length ? <ul className="space-y-3">{recent.map((session) => (
              <li key={session.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0"><p className="truncate font-medium">{session.task_id ? tasks.find((t) => t.id === session.task_id)?.title ?? "Focus session" : "Focus session"}</p><p className="text-xs text-muted-foreground">{format(new Date(session.started_at), "MMM d · h:mm a")}</p></div>
                <span className="shrink-0 tabular-nums text-muted-foreground">{Math.round(session.duration_seconds / 60)}m</span>
              </li>
            ))}</ul> : <p className="text-sm text-muted-foreground">Your completed focus sessions will appear here.</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
