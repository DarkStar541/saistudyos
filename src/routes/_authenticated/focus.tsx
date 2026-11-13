import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, Pause, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useCourses, useFocusSessions, useProfile, useSave, useTasks, type Task } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QueryState } from "@/components/query-state";

export const Route = createFileRoute("/_authenticated/focus")({
  head: () => ({ meta: [{ title: "Focus — Pace" }, { name: "description", content: "A quiet place to work on one thing at a time." }] }),
  component: FocusPage,
});

type TimerState = { startedAt: number; endsAt: number; pausedRemainingMs: number | null; pausedAt: number | null; accumulatedPausedMs: number; taskId: string | null };
const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

function FocusPage() {
  const profileQuery = useProfile();
  const tasksQuery = useTasks();
  const coursesQuery = useCourses();
  const sessionsQuery = useFocusSessions();
  const profile = profileQuery.data;
  const tasks = tasksQuery.data ?? [];
  const courses = coursesQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];
  const saveSession = useSave("focus_sessions");
  const [selectedTask, setSelectedTask] = useState("");
  const [duration, setDuration] = useState(25);
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const finishing = useRef(false);
  const storageKey = profile ? `pace-focus-timer:${profile.id}` : null;

  useEffect(() => {
    if (!profile) return;
    setDuration(profile.focus_minutes || 25);
    try {
      const saved = localStorage.getItem(`pace-focus-timer:${profile.id}`);
      if (saved) {
        const parsed = JSON.parse(saved) as TimerState;
        if (parsed && typeof parsed.startedAt === "number" && typeof parsed.endsAt === "number" && typeof parsed.accumulatedPausedMs === "number" && (parsed.pausedRemainingMs === null || typeof parsed.pausedRemainingMs === "number")) {
          setTimer(parsed);
          setSelectedTask(parsed.taskId ?? "");
        }
      }
    } catch {
      localStorage.removeItem(`pace-focus-timer:${profile.id}`);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!timer || timer.pausedRemainingMs !== null) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [timer]);

  useEffect(() => {
    if (!storageKey) return;
    if (timer) localStorage.setItem(storageKey, JSON.stringify(timer));
    else localStorage.removeItem(storageKey);
  }, [timer, storageKey]);

  const remaining = timer
    ? Math.max(0, Math.ceil((timer.pausedRemainingMs ?? Math.max(0, timer.endsAt - now)) / 1000))
    : duration * 60;
  const selected = tasks.find((task) => task.id === (timer?.taskId ?? selectedTask));
  const todaySessions = sessions.filter((session) => session.kind === "focus" && new Date(session.started_at).toDateString() === new Date().toDateString());
  const todayMinutes = Math.round(todaySessions.reduce((sum, session) => sum + session.duration_seconds, 0) / 60);
  const activeTasks = tasks.filter((task) => task.status !== "done");

  async function finish(completed: boolean) {
    if (!timer || !profile || finishing.current) return;
    finishing.current = true;
    const end = Date.now();
    const started = new Date(timer.startedAt);
    const seconds = timer.pausedRemainingMs !== null ? Math.max(0, Math.floor((duration * 60_000 - timer.pausedRemainingMs) / 1000)) : Math.max(0, Math.floor((end - timer.startedAt - timer.accumulatedPausedMs) / 1000));
    try {
      await saveSession.mutateAsync({
        user_id: profile.id,
        task_id: timer.taskId,
        course_id: tasks.find((task) => task.id === timer.taskId)?.course_id ?? null,
        kind: "focus",
        started_at: started.toISOString(),
        ended_at: new Date(end).toISOString(),
        duration_seconds: completed ? duration * 60 : seconds,
        planned_seconds: duration * 60,
        completed,
      });
      setTimer(null);
      await sessionsQuery.refetch();
      toast.success(completed ? "Focus session completed" : "Focus session saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the focus session");
    } finally {
      finishing.current = false;
    }
  }

  useEffect(() => {
    if (timer && timer.pausedRemainingMs === null && remaining === 0) void finish(true);
  }, [remaining, timer?.startedAt]);

  function start() {
    const startAt = Date.now();
    setTimer({ startedAt: startAt, endsAt: startAt + duration * 60_000, pausedRemainingMs: null, pausedAt: null, accumulatedPausedMs: 0, taskId: selectedTask || null });
    setNow(startAt);
  }
  function pause() {
    if (!timer || timer.pausedRemainingMs !== null) return;
    setTimer({ ...timer, pausedRemainingMs: Math.max(0, timer.endsAt - Date.now()), pausedAt: Date.now() });
  }
  function resume() {
    if (!timer || timer.pausedRemainingMs === null) return;
    setTimer({ ...timer, endsAt: Date.now() + timer.pausedRemainingMs, pausedRemainingMs: null, accumulatedPausedMs: timer.accumulatedPausedMs + (timer.pausedAt ? Date.now() - timer.pausedAt : 0), pausedAt: null });
    setNow(Date.now());
  }
  function reset() {
    setTimer(null);
    finishing.current = false;
  }

  if (profileQuery.isLoading || tasksQuery.isLoading || coursesQuery.isLoading || sessionsQuery.isLoading) return <QueryState loading loadingLabel="Preparing your focus space…" />;
  const error = profileQuery.error ?? tasksQuery.error ?? coursesQuery.error ?? sessionsQuery.error;
  if (error) return <QueryState error={error} onRetry={() => { void Promise.all([profileQuery.refetch(), tasksQuery.refetch(), coursesQuery.refetch(), sessionsQuery.refetch()]); }} />;
  if (!profile) return <QueryState error={new Error("Your profile is unavailable. Please sign in again.")} />;

  const progress = timer ? Math.min(100, Math.max(0, ((duration * 60 - remaining) / (duration * 60)) * 100)) : 0;
  return (
    <div className="mx-auto max-w-4xl">
      <header className="page-intro mb-8 border-b border-border/70 pb-6">
        <p className="overline-label mb-2">SINGLE-TASK WORKSPACE</p>
        <h1 className="text-5xl font-semibold">Focus<span className="text-primary">.</span></h1>
        <p className="mt-2 text-sm text-muted-foreground">One task. One session. Give it your attention.</p>
      </header>
      <section className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-10">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-sm font-medium text-muted-foreground">{timer ? (timer.pausedRemainingMs === null ? "SESSION IN PROGRESS" : "SESSION PAUSED") : "READY WHEN YOU ARE"}</p>
          <div className="relative mx-auto my-7 grid size-64 place-items-center rounded-full border-[10px] border-muted sm:size-72" role="timer" aria-live="off">
            <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 288 288" aria-hidden="true">
              <circle cx="144" cy="144" r="134" fill="none" stroke="currentColor" strokeOpacity=".08" strokeWidth="8" />
              <circle cx="144" cy="144" r="134" fill="none" stroke="currentColor" className="text-primary" strokeWidth="8" strokeLinecap="round" strokeDasharray={Math.PI * 268} strokeDashoffset={Math.PI * 268 * (1 - progress / 100)} />
            </svg>
            <div><p className="font-display text-6xl font-semibold tabular-nums tracking-tight">{formatTime(remaining)}</p><p className="mt-2 text-sm text-muted-foreground">{timer ? (timer.pausedRemainingMs === null ? "Time remaining" : "Paused") : `${duration} minute session`}</p></div>
          </div>
          {!timer && <div className="mx-auto mb-5 max-w-sm space-y-3 text-left">
            <label className="block text-sm font-medium">Work on</label>
            <Select value={selectedTask || "__none__"} onValueChange={(value) => setSelectedTask(value === "__none__" ? "" : value)}>
              <SelectTrigger><SelectValue placeholder="Choose a task (optional)" /></SelectTrigger>
              <SelectContent><SelectItem value="__none__">No specific task</SelectItem>{activeTasks.map((task) => <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>)}</SelectContent>
            </Select>
            <label className="block text-sm font-medium">Session length</label>
            <Select value={String(duration)} onValueChange={(value) => setDuration(Number(value))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[15, 20, 25, 30, 45, 50, 60, 90].map((minutes) => <SelectItem key={minutes} value={String(minutes)}>{minutes} minutes</SelectItem>)}</SelectContent>
            </Select>
          </div>}
          {timer && selected && <p className="mb-5 text-sm text-muted-foreground">Working on <span className="font-medium text-foreground">{selected.title}</span></p>}
          <div className="flex flex-wrap justify-center gap-2">
            {!timer ? <Button size="lg" onClick={start}><Play className="mr-2 size-4" /> Start focus</Button> : <>
              {timer.pausedRemainingMs === null ? <Button size="lg" variant="outline" onClick={pause}><Pause className="mr-2 size-4" /> Pause</Button> : <Button size="lg" onClick={resume}><Play className="mr-2 size-4" /> Resume</Button>}
              <Button size="lg" variant="outline" onClick={() => void finish(false)} disabled={saveSession.isPending}><Check className="mr-2 size-4" /> Finish early</Button>
              <Button size="lg" variant="ghost" onClick={reset}><RotateCcw className="mr-2 size-4" /> Discard</Button>
            </>}
          </div>
        </div>
      </section>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Focus today</p><p className="mt-2 text-3xl font-semibold tabular-nums">{Math.floor(todayMinutes / 60)}h {todayMinutes % 60}m</p><p className="mt-1 text-xs text-muted-foreground">{todaySessions.length} recorded sessions</p></section>
        <section className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Recent sessions</p>{sessions.slice(0, 4).length ? <ul className="mt-3 space-y-2">{sessions.slice(0, 4).map((session) => <li key={session.id} className="flex justify-between gap-3 text-sm"><span className="truncate">{tasks.find((task) => task.id === session.task_id)?.title ?? "Independent focus"}</span><span className="shrink-0 text-muted-foreground">{Math.round(session.duration_seconds / 60)} min</span></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">Your completed sessions will appear here.</p>}</section>
      </div>
    </div>
  );
}
