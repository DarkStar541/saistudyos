import { format, isToday, isTomorrow } from "date-fns";
import { CalendarClock, Flag, Hammer, Repeat } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { colorVar, useToggleTask, type Course, type Task } from "@/lib/db";
import { isOverdue, parsePlanned } from "@/lib/task-utils";
import { cn } from "@/lib/utils";

const rel = (d: Date, withTime = false) =>
  isToday(d) ? (withTime ? `Today ${format(d, "p")}` : "Today") : isTomorrow(d) ? (withTime ? `Tmrw ${format(d, "p")}` : "Tomorrow") : format(d, withTime ? "EEE MMM d, p" : "EEE MMM d");

export const PRIORITY_CLASS: Record<string, string> = {
  low: "text-muted-foreground",
  medium: "text-[var(--course-blue)]",
  high: "text-warning",
  urgent: "text-destructive",
};

export function TaskRow({ task, course, onOpen, compact }: { task: Task; course?: Course | undefined; onOpen: (t: Task) => void; compact?: boolean }) {
  const toggle = useToggleTask();
  const done = task.status === "done";
  const overdue = isOverdue(task);
  const planned = parsePlanned(task.planned_date);
  return (
    <div className={cn("group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/60", done && "opacity-55")}>
      <Checkbox className="mt-0.5 rounded-full" checked={done} onCheckedChange={() => toggle.mutate(task)} aria-label={`Complete ${task.title}`} />
      <button onClick={() => onOpen(task)} className="min-w-0 flex-1 text-left">
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
            <span className={cn("flex items-center gap-1", overdue && "font-semibold text-destructive")}>
              <CalendarClock className="size-3" /> Due {rel(new Date(task.due_at), true)}
            </span>
          )}
          {planned && (
            <span className="flex items-center gap-1 text-primary">
              <Hammer className="size-3" /> Work {rel(planned)}
            </span>
          )}
          {task.recurrence !== "none" && <Repeat className="size-3" />}
          {!compact && task.tags.map((t) => <span key={t} className="rounded bg-secondary px-1.5 text-secondary-foreground">#{t}</span>)}
        </div>
      </button>
      {task.priority !== "medium" && task.priority !== "low" && <Flag className={cn("mt-0.5 size-3.5", PRIORITY_CLASS[task.priority])} />}
    </div>
  );
}
