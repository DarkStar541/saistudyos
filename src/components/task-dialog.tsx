import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Paperclip, Plus, SkipForward, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { seriesIdOf, useCourses, useMilestones, useProfile, useProjects, useRemove, useSkipOccurrence, useSubtasks, type Task } from "@/lib/db";
import { PRIORITIES, STATUSES, STATUS_LABEL, TASK_TYPES } from "@/lib/task-utils";
import { RECURRENCE_OPTIONS, WEEKDAY_LABELS, describeRecurrence } from "@/lib/recurrence";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/date-picker";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task?: Task | null | undefined;
  defaults?: undefined | Partial<Pick<Task, "course_id" | "project_id" | "planned_date" | "task_type">>;
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ");
const NONE = "__none__";

export function TaskDialog({ open, onOpenChange, task, defaults }: Props) {
  const { data: courses = [] } = useCourses();
  const { data: projects = [] } = useProjects();
  const { data: milestones = [] } = useMilestones();
  const { data: allSubs = [] } = useSubtasks();
  const { data: profile } = useProfile();
  const remove = useRemove("tasks");
  const skip = useSkipOccurrence();
  const qc = useQueryClient();

  const blank = () => ({
    title: "", description: "", course_id: defaults?.course_id ?? "", project_id: defaults?.project_id ?? "", milestone_id: "",
    task_type: defaults?.task_type ?? "assignment", status: "todo", priority: profile?.default_priority ?? "medium",
    due_date: "", due_time: "23:59", planned_date: defaults?.planned_date ?? "",
    estimated_minutes: String(profile?.default_duration_minutes ?? 60), tags: "",
    recurrence: "none", recurrence_interval: "1", recurrence_days: [] as number[], recurrence_end: "", separate_end: false,
  });
  const [f, setF] = useState(blank);
  const [subs, setSubs] = useState<{ id?: string; title: string; done: boolean }[]>([]);
  const [newSub, setNewSub] = useState("");
  const [saving, setSaving] = useState(false);
  const [applySeries, setApplySeries] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    if (task) {
      const d = task.due_at ? new Date(task.due_at) : null;
      setF({
        title: task.title, description: task.description ?? "", course_id: task.course_id ?? "", project_id: task.project_id ?? "",
        milestone_id: task.milestone_id ?? "", task_type: task.task_type, status: task.status, priority: task.priority,
        due_date: d ? format(d, "yyyy-MM-dd") : "", due_time: d ? format(d, "HH:mm") : "23:59",
        planned_date: task.planned_date ?? "", estimated_minutes: task.estimated_minutes?.toString() ?? "",
        tags: task.tags.join(", "), recurrence: task.recurrence,
        recurrence_interval: String(task.recurrence_interval ?? 1), recurrence_days: task.recurrence_days ?? [],
        recurrence_end: task.recurrence_end ?? "", separate_end: !!(task.recurrence_end && task.due_at),
      });
      setSubs(allSubs.filter((s) => s.task_id === task.id).map((s) => ({ id: s.id, title: s.title, done: s.done })));
    } else {
      setF(blank());
      setSubs([]);
    }
    setNewSub("");
    setApplySeries(false);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  const projectMilestones = useMemo(() => milestones.filter((m) => m.project_id === f.project_id), [milestones, f.project_id]);
  const patch = (k: keyof typeof f, v: string | number[] | boolean) => setF((p) => ({ ...p, [k]: v }));
  const isRecurring = f.recurrence !== "none";
  // With a deadline the series ends there unless a separate end is chosen; without one, "Repeat until" is required.
  const showRepeatUntil = isRecurring && (!f.due_date || f.separate_end);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) return void toast.error("Give the task a title");
    if (isRecurring && showRepeatUntil && !f.recurrence_end) return void toast.error(f.due_date ? "Pick a repeat end date, or turn off the separate end date" : "Repeating tasks without a deadline need a Repeat until date");
    if (isRecurring && f.recurrence_end && f.planned_date && f.recurrence_end < f.planned_date) return void toast.error("Repeat until can't be before the work date");
    if (f.due_date && f.planned_date && f.planned_date > f.due_date) toast.warning("Heads up: planned work date is after the deadline");
    setSaving(true);
    try {
      const row = {
        title: f.title.trim().slice(0, 300), description: f.description || null, course_id: f.course_id || null,
        project_id: f.project_id || null, milestone_id: f.project_id && f.milestone_id ? f.milestone_id : null,
        task_type: f.task_type, status: f.status, priority: f.priority,
        due_at: f.due_date ? new Date(`${f.due_date}T${f.due_time || "23:59"}`).toISOString() : null,
        planned_date: f.planned_date || (isRecurring ? format(new Date(), "yyyy-MM-dd") : null),
        estimated_minutes: f.estimated_minutes ? Math.max(0, Math.min(10000, parseInt(f.estimated_minutes) || 0)) : null,
        tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20),
        recurrence: f.recurrence,
        recurrence_interval: Math.max(1, Math.min(365, parseInt(f.recurrence_interval) || 1)),
        recurrence_days: f.recurrence === "weekly" && f.recurrence_days.length ? f.recurrence_days : null,
        recurrence_end: showRepeatUntil && f.recurrence_end ? f.recurrence_end : null,
        completed_at: f.status === "done" ? task?.completed_at ?? new Date().toISOString() : null,
      };
      const res = task
        ? await supabase.from("tasks").update(row).eq("id", task.id).select().single()
        : await supabase.from("tasks").insert(row).select().single();
      if (res.error) throw res.error;
      const savedTask = res.data as Task;
      const taskId = savedTask.id;

      // Update the shared task cache immediately so dashboard gauges and radar
      // reflect changed work dates as soon as Save succeeds.
      qc.setQueryData<Task[]>(["tasks"], (current) => {
        if (!current) return current;
        return task
          ? current.map((item) => item.id === taskId ? savedTask : item)
          : [savedTask, ...current];
      });

      // Apply scheduling + recurrence changes to the whole series when asked.
      if (task && applySeries && task.recurrence !== "none") {
        const sid = seriesIdOf(task);
        const seriesPatch = {
          recurrence: row.recurrence, recurrence_interval: row.recurrence_interval,
          recurrence_days: row.recurrence_days, recurrence_end: row.recurrence_end,
          priority: row.priority, estimated_minutes: row.estimated_minutes, course_id: row.course_id,
        };
        // If the edited occurrence is a child, keep the series root in sync too.
        if (task.id !== sid) {
          const rootResult = await supabase.from("tasks").update(seriesPatch).eq("id", sid);
          if (rootResult.error) throw rootResult.error;
        }
        const seriesResult = await supabase
          .from("tasks")
          .update(seriesPatch)
          .eq("recurrence_parent_id", sid)
          .neq("id", taskId)
          .neq("status", "done");
        if (seriesResult.error) throw seriesResult.error;
      }

      // Sync subtasks
      const existing = allSubs.filter((s) => s.task_id === taskId);
      const keepIds = new Set(subs.filter((s) => s.id).map((s) => s.id));
      const toDelete = existing.filter((s) => !keepIds.has(s.id)).map((s) => s.id);
      if (toDelete.length) {
        const deleteResult = await supabase.from("subtasks").delete().in("id", toDelete);
        if (deleteResult.error) throw deleteResult.error;
      }
      for (const [i, s] of subs.entries()) {
        const subtaskResult = s.id
          ? await supabase.from("subtasks").update({ title: s.title, done: s.done, position: i }).eq("id", s.id)
          : await supabase.from("subtasks").insert({ task_id: taskId, title: s.title, done: s.done, position: i });
        if (subtaskResult.error) throw subtaskResult.error;
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["tasks"] }),
        qc.invalidateQueries({ queryKey: ["subtasks"] }),
      ]);
      toast.success(task ? "Task updated" : "Task added");
      onOpenChange(false);
    } catch (err) {
      // The task row may already have saved before a series/subtask write failed.
      // Reconcile the cache so the editor and dashboard reflect persisted data.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["tasks"] }),
        qc.invalidateQueries({ queryKey: ["subtasks"] }),
      ]);
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <Input autoFocus placeholder="e.g. Chapter 7 reading questions" value={f.title} onChange={(e) => patch("title", e.target.value)} className="h-11 text-base" />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Course">
              <Select value={f.course_id || NONE} onValueChange={(v) => patch("course_id", v === NONE ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="No course" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No course</SelectItem>
                  {courses.filter((c) => !c.archived || c.id === f.course_id).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.code ? `${c.code} · ` : ""}{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Type">
              <Select value={f.task_type} onValueChange={(v) => patch("task_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TASK_TYPES.map((t) => <SelectItem key={t} value={t}>{cap(t)}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={f.priority} onValueChange={(v) => patch("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((t) => <SelectItem key={t} value={t}>{cap(t)}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 rounded-xl border border-border bg-muted/40 p-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs font-semibold text-destructive">Deadline (due)</Label>
              <div className="mt-1 flex gap-2">
                <DatePicker value={f.due_date} onChange={(v) => patch("due_date", v)} placeholder="No deadline" />
                <Input type="time" value={f.due_time} onChange={(e) => patch("due_time", e.target.value)} className="w-28" disabled={!f.due_date} />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-primary">Plan to work on</Label>
              <DatePicker className="mt-1" value={f.planned_date} onChange={(v) => patch("planned_date", v)} placeholder="Not planned" />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">The deadline is when it's due. The work date is when you'll actually do it — that's what shows up in your Today list.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Status">
              <Select value={f.status} onValueChange={(v) => patch("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((t) => <SelectItem key={t} value={t}>{STATUS_LABEL[t]}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Est. minutes">
              <Input type="number" min={0} value={f.estimated_minutes} onChange={(e) => patch("estimated_minutes", e.target.value)} />
            </Field>
            <Field label="Tags">
              <Input placeholder="comma, separated" value={f.tags} onChange={(e) => patch("tags", e.target.value)} />
            </Field>
          </div>

          {/* Recurrence */}
          <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Repeats">
                <Select value={f.recurrence} onValueChange={(v) => patch("recurrence", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RECURRENCE_OPTIONS.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              {(f.recurrence === "custom" || f.recurrence === "daily" || f.recurrence === "monthly") && (
                <Field label={f.recurrence === "custom" ? "Every N days" : f.recurrence === "daily" ? "Every N days" : "Every N months"}>
                  <Input type="number" min={1} max={365} value={f.recurrence_interval} onChange={(e) => patch("recurrence_interval", e.target.value)} />
                </Field>
              )}
              {showRepeatUntil && (
                <Field label="Repeat until">
                  <DatePicker value={f.recurrence_end} onChange={(v) => patch("recurrence_end", v)} placeholder="Pick an end date" />
                </Field>
              )}
            </div>
            {f.recurrence === "weekly" && (
              <div>
                <Label className="text-xs text-muted-foreground">On days</Label>
                <div className="mt-1 flex gap-1">
                  {WEEKDAY_LABELS.map((l, d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => patch("recurrence_days", f.recurrence_days.includes(d) ? f.recurrence_days.filter((x) => x !== d) : [...f.recurrence_days, d])}
                      className={cn(
                        "grid size-8 place-items-center rounded-full text-xs font-medium transition-colors",
                        f.recurrence_days.includes(d) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {isRecurring && f.due_date && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={f.separate_end} onCheckedChange={(v) => patch("separate_end", !!v)} />
                Set a separate repeat end date
              </label>
            )}
            {isRecurring && (
              <p className="text-xs text-muted-foreground">
                {describeRecurrence({ recurrence: f.recurrence, recurrence_interval: parseInt(f.recurrence_interval) || 1, recurrence_days: f.recurrence_days, recurrence_end: showRepeatUntil ? f.recurrence_end || null : f.due_date || null })}
                {" "}— completing it creates the next work session automatically.
                {f.due_date && !f.separate_end && " Repeats stop at the deadline."}
                {f.due_date && f.separate_end && " The deadline stays the real due date."}
                {!f.due_date && " No deadline — nothing will show as due."}
              </p>
            )}
            {task && task.recurrence !== "none" && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-2">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={applySeries} onCheckedChange={(v) => setApplySeries(!!v)} />
                  Apply changes to the whole series
                </label>
                <Button
                  type="button" size="sm" variant="ghost" className="h-7 text-xs"
                  disabled={skip.isPending}
                  onClick={async () => { await skip.mutateAsync(task); onOpenChange(false); }}
                >
                  <SkipForward className="size-3.5" /> Skip this occurrence
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Project">
              <Select value={f.project_id || NONE} onValueChange={(v) => { patch("project_id", v === NONE ? "" : v); if (v === NONE) patch("milestone_id", ""); }}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Milestone">
              <Select value={f.milestone_id || NONE} onValueChange={(v) => patch("milestone_id", v === NONE ? "" : v)} disabled={!projectMilestones.length}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {projectMilestones.map((m) => <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Notes">
            <Textarea rows={3} value={f.description} onChange={(e) => patch("description", e.target.value)} placeholder="Instructions, links, anything useful" />
          </Field>

          <div>
            <Label className="text-xs text-muted-foreground">Subtasks</Label>
            <div className="mt-1 space-y-1.5">
              {subs.map((s, i) => (
                <div key={s.id ?? i} className="flex items-center gap-2">
                  <Checkbox checked={s.done} onCheckedChange={(v) => setSubs((p) => p.map((x, j) => (j === i ? { ...x, done: !!v } : x)))} />
                  <Input className="h-8" value={s.title} onChange={(e) => setSubs((p) => p.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                  <Button type="button" size="icon" variant="ghost" className="size-8" onClick={() => setSubs((p) => p.filter((_, j) => j !== i))}><X className="size-4" /></Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input className="h-8" placeholder="Add a step…" value={newSub} onChange={(e) => setNewSub(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (newSub.trim()) { setSubs((p) => [...p, { title: newSub.trim(), done: false }]); setNewSub(""); } } }} />
                <Button type="button" size="icon" variant="outline" className="size-8" onClick={() => { if (newSub.trim()) { setSubs((p) => [...p, { title: newSub.trim(), done: false }]); setNewSub(""); } }}><Plus className="size-4" /></Button>
              </div>
            </div>
          </div>

          <p className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
            <Paperclip className="size-3.5" /> File attachments arrive with the Knowledge Library (Stage 4).
          </p>

          <div className="flex items-center justify-between gap-2 pt-2">
            {task ? (
              <Button type="button" variant="ghost" className="text-destructive" onClick={async () => { await remove.mutateAsync(task.id); onOpenChange(false); }}>
                <Trash2 className="size-4" /> Delete
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : task ? "Save" : "Add task"}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
