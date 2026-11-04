import { useMemo, useState } from "react";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { colorVar, type Course, type Task } from "@/lib/db";
import { STATUSES, STATUS_LABEL, isOverdue, toDateKey } from "@/lib/task-utils";
import { Button } from "@/components/ui/button";
import { TaskRow, PRIORITY_CLASS } from "@/components/task-row";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ViewProps = { tasks: Task[]; courses: Map<string, Course>; onOpen: (t: Task) => void };

function useMove() {
  const qc = useQueryClient();
  return async (id: string, patch: Partial<Task>) => {
    qc.setQueryData<Task[]>(["tasks"], (old) => old?.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const { error } = await supabase.from("tasks").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };
}

export function ListView({ tasks, courses, onOpen }: ViewProps) {
  const groups = useMemo(() => {
    const now = new Date();
    const g: Record<string, Task[]> = { Overdue: [], "No deadline": [], Done: [] };
    const dated: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (t.status === "done") g.Done.push(t);
      else if (isOverdue(t, now)) g.Overdue.push(t);
      else if (!t.due_at) g["No deadline"].push(t);
      else {
        const k = format(new Date(t.due_at), "yyyy-MM-dd");
        (dated[k] ??= []).push(t);
      }
    }
    const out: [string, Task[]][] = [];
    if (g.Overdue.length) out.push(["Overdue", g.Overdue]);
    for (const k of Object.keys(dated).sort()) {
      const d = new Date(`${k}T00:00`);
      out.push([isToday(d) ? "Due today" : `Due ${format(d, "EEEE, MMM d")}`, dated[k]]);
    }
    if (g["No deadline"].length) out.push(["No deadline", g["No deadline"]]);
    if (g.Done.length) out.push(["Done", g.Done]);
    return out;
  }, [tasks]);

  if (!tasks.length) return <Empty />;
  return (
    <div className="space-y-6">
      {groups.map(([label, items]) => (
        <section key={label}>
          <h3 className={cn("mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground", label === "Overdue" && "text-destructive")}>
            {label} <span className="font-normal">· {items.length}</span>
          </h3>
          <div className="rounded-2xl border border-border bg-card p-1 shadow-card">
            {items.map((t) => <TaskRow key={t.id} task={t} course={t.course_id ? courses.get(t.course_id) : undefined} onOpen={onOpen} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

export function BoardView({ tasks, courses, onOpen }: ViewProps) {
  const move = useMove();
  const [over, setOver] = useState<string | null>(null);
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {STATUSES.map((s) => {
        const items = tasks.filter((t) => t.status === s);
        return (
          <div
            key={s}
            onDragOver={(e) => { e.preventDefault(); setOver(s); }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              setOver(null);
              const id = e.dataTransfer.getData("text/task");
              if (id) move(id, { status: s, completed_at: s === "done" ? new Date().toISOString() : null });
            }}
            className={cn("min-h-40 rounded-2xl bg-muted/50 p-3 transition-colors", over === s && "bg-accent")}
          >
            <h3 className="mb-3 flex items-center justify-between px-1 text-sm font-semibold">
              {STATUS_LABEL[s]} <span className="text-xs font-normal text-muted-foreground">{items.length}</span>
            </h3>
            <div className="space-y-2">
              {items.map((t) => {
                const c = t.course_id ? courses.get(t.course_id) : undefined;
                return (
                  <button
                    key={t.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/task", t.id)}
                    onClick={() => onOpen(t)}
                    className="block w-full cursor-grab rounded-xl border border-border bg-card p-3 text-left shadow-card active:cursor-grabbing"
                    style={{ borderLeft: `3px solid ${c ? colorVar(c.color) : "var(--border)"}` }}
                  >
                    <p className="text-sm font-medium">{t.title}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      {c && <span>{c.code || c.name}</span>}
                      {t.due_at && <span className={cn(isOverdue(t) && "text-destructive")}>Due {format(new Date(t.due_at), "MMM d")}</span>}
                      {t.planned_date && <span className="text-primary">Work {format(new Date(`${t.planned_date}T00:00`), "MMM d")}</span>}
                      <Flag className={cn("ml-auto size-3", PRIORITY_CLASS[t.priority])} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CalendarView({ tasks, courses, onOpen, weekStartsOn = 1 }: ViewProps & { weekStartsOn?: 0 | 1 }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [mode, setMode] = useState<"planned" | "due">("planned");
  const move = useMove();
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn });
    const out: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [month, weekStartsOn]);

  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) {
      const key = mode === "due" ? (t.due_at ? toDateKey(new Date(t.due_at)) : null) : t.planned_date ?? (t.due_at ? toDateKey(new Date(t.due_at)) : null);
      if (!key) continue;
      (m.get(key) ?? m.set(key, []).get(key)!).push(t);
    }
    return m;
  }, [tasks, mode]);

  const labels = Array.from({ length: 7 }, (_, i) => format(addDays(startOfWeek(new Date(), { weekStartsOn }), i), "EEE"));

  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-card md:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold">{format(month, "MMMM yyyy")}</h3>
        <div className="ml-auto flex items-center gap-1 rounded-lg bg-muted p-0.5 text-xs">
          {(["planned", "due"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cn("rounded-md px-2.5 py-1", mode === m && "bg-card shadow-sm")}>
              {m === "planned" ? "Work dates" : "Deadlines"}
            </button>
          ))}
        </div>
        <Button size="icon" variant="ghost" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Previous month"><ChevronLeft className="size-4" /></Button>
        <Button size="sm" variant="outline" onClick={() => setMonth(startOfMonth(new Date()))}>Today</Button>
        <Button size="icon" variant="ghost" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month"><ChevronRight className="size-4" /></Button>
      </div>
      {mode === "planned" && <p className="mb-2 text-xs text-muted-foreground">Drag a task to another day to reschedule when you'll work on it. Deadlines don't change.</p>}
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border text-xs">
        {labels.map((l) => <div key={l} className="bg-muted px-2 py-1.5 font-medium text-muted-foreground">{l}</div>)}
        {days.map((d) => {
          const key = toDateKey(d);
          const items = byDay.get(key) ?? [];
          return (
            <div
              key={key}
              onDragOver={(e) => mode === "planned" && e.preventDefault()}
              onDrop={(e) => { const id = e.dataTransfer.getData("text/task"); if (id) move(id, { planned_date: key }); }}
              className={cn("min-h-20 bg-card p-1 md:min-h-28", !isSameMonth(d, month) && "bg-muted/40 text-muted-foreground")}
            >
              <div className={cn("mb-1 grid size-6 place-items-center rounded-full", isToday(d) && "bg-primary font-semibold text-primary-foreground")}>{format(d, "d")}</div>
              <div className="space-y-0.5">
                {items.slice(0, 4).map((t) => {
                  const c = t.course_id ? courses.get(t.course_id) : undefined;
                  return (
                    <button
                      key={t.id}
                      draggable={mode === "planned"}
                      onDragStart={(e) => e.dataTransfer.setData("text/task", t.id)}
                      onClick={() => onOpen(t)}
                      className={cn("block w-full truncate rounded px-1 py-0.5 text-left", t.status === "done" && "line-through opacity-50", t.task_type === "exam" && "font-semibold")}
                      style={{ background: `color-mix(in oklab, ${c ? colorVar(c.color) : "var(--primary)"} 18%, transparent)` }}
                    >
                      {t.title}
                    </button>
                  );
                })}
                {items.length > 4 && <p className="px-1 text-muted-foreground">+{items.length - 4} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <p className="font-medium">Nothing here yet</p>
      <p className="mt-1 text-sm text-muted-foreground">Press <kbd className="rounded bg-muted px-1.5">N</kbd> to add your first task.</p>
    </div>
  );
}
