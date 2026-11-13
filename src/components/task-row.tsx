import { addDays, format } from "date-fns";
import { useNavigate } from "@tanstack/react-router";
import { CalendarClock, Flag, Hammer, Repeat, Timer } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { colorVar, useProfile, useToggleTask, type Course, type Task } from "@/lib/db";
import { dateKeyInTimeZone, isOverdue, parsePlanned, toDateKey } from "@/lib/task-utils";
import { cn } from "@/lib/utils";

const rel = (d: Date, withTime = false, timeZone?: string) => {
  const dayKey = dateKeyInTimeZone(d, timeZone);
  const todayKey = dateKeyInTimeZone(new Date(), timeZone);
  const today = parsePlanned(todayKey);
  const tomorrowKey = today ? toDateKey(addDays(today, 1)) : "";
  const day = parsePlanned(dayKey) ?? d;
  const label = dayKey === todayKey ? "Today" : dayKey === tomorrowKey ? "Tomorrow" : format(day, "EEE MMM d");
  if (!withTime) return label;
  let time = format(d, "p");
  if (timeZone) {
    try { time = new Intl.DateTimeFormat(undefined, { timeZone, hour: "numeric", minute: "2-digit" }).format(d); } catch { /* Fall back to browser time. */ }
  }
  return `${label} ${time}`;
};

const relPlanned = (dayKey: string, timeZone?: string) => {
  const todayKey = dateKeyInTimeZone(new Date(), timeZone);
  const today = parsePlanned(todayKey);
  const tomorrowKey = today ? toDateKey(addDays(today, 1)) : "";
  const day = parsePlanned(dayKey);
  if (!day) return dayKey;
  return dayKey === todayKey ? "Today" : dayKey === tomorrowKey ? "Tomorrow" : format(day, "EEE MMM d");
};

export const PRIORITY_CLASS: Record<string, string> = {
  low: "text-muted-foreground",
  medium: "text-[var(--course-blue)]",
  high: "text-warning",
  urgent: "text-destructive",
};

export function TaskRow({ task, course, onOpen, compact, timeZone }: { task: Task; course?: Course | undefined; onOpen: (t: Task) => void; compact?: boolean; timeZone?: string }) {
  const toggle = useToggleTask();
  const navigate = useNavigate();
  const profile = useProfile().data;
  const done = task.status === "done";
  const overdue = isOverdue(task);
  const plannedLabel = task.planned_date ? relPlanned(task.planned_date, timeZone) : null;
  return (
    <div className={cn("group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent/50", done && "opacity-55")}>
      <Checkbox className="mt-0.5 rounded-full" checked={done} onCheckedChange={() => toggle.mutate(task)} aria-label={`Complete ${task.title}`} />
      <button onClick={() => onOpen(task)} className="min-w-0 flex-1 text-left transition-colors duration-150 hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none">
        <p className={cn("truncate text-sm font-medium", done && "line-through")}>{task.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {course && (
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: colorVar(course.color) }} />
              {course.code || course.name}
            </span>
          )}
          {!compact && task.task_type !== "assignment" && <span className="capitalize">{task.task_type}</span>}
          {task.due_at && (
            <span className={cn("flex items-center gap-1", overdue && "font-medium text-destructive")}>
              <CalendarClock className="size-3" /> Due {rel(new Date(task.due_at), true, timeZone)}
            </span>
          )}
          {plannedLabel && (
            <span className="flex items-center gap-1 text-primary">
              <Hammer className="size-3" /> Work {plannedLabel}
            </span>
          )}
          {task.recurrence !== "none" && <Repeat className="size-3" />}
          {!compact && task.tags.map((t) => <span key={t} className="rounded bg-secondary px-1.5 text-secondary-foreground">#{t}</span>)}
        </div>
      </button>
      <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground" disabled={done || !profile?.id} aria-label={`Focus on ${task.title}`} title="Focus on this task" onClick={() => { if (!profile?.id) return; localStorage.setItem(`pace-focus-next-task:${profile.id}`, task.id); void navigate({ to: "/focus" }); }}><Timer className="size-3.5" /><span className="hidden sm:inline">Focus</span></Button>
      {task.priority !== "medium" && task.priority !== "low" && <Flag className={cn("mt-0.5 size-3.5", PRIORITY_CLASS[task.priority])} />}
    </div>
  );
}
