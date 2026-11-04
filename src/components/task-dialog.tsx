import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Paperclip, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCourses, useMilestones, useProfile, useProjects, useRemove, useSubtasks, type Task } from "@/lib/db";
import { PRIORITIES, RECURRENCES, STATUSES, STATUS_LABEL, TASK_TYPES } from "@/lib/task-utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task?: Task | null | undefined;
  defaults?: undefined | Partial<Pick<Task, "course_id" | "project_id" | "planned_date" | "task_type">>;
};

const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ");

export function TaskDialog({ open, onOpenChange, task, defaults }: Props) {
  const { data: courses = [] } = useCourses();
  const { data: projects = [] } = useProjects();
  const { data: milestones = [] } = useMilestones();
  const { data: allSubs = [] } = useSubtasks();
  const { data: profile } = useProfile();
  const remove = useRemove("tasks");
  const qc = useQueryClient();

  const blank = () => ({
    title: "", description: "", course_id: defaults?.course_id ?? "", project_id: defaults?.project_id ?? "", milestone_id: "",
    task_type: defaults?.task_type ?? "assignment", status: "todo", priority: profile?.default_priority ?? "medium",
    due_date: "", due_time: "23:59", planned_date: defaults?.planned_date ?? "",
    estimated_minutes: String(profile?.default_duration_minutes ?? 60), tags: "", recurrence: "none",
  });
  const [f, setF] = useState(blank);
  const [subs, setSubs] = useState<{ id?: string; title: string; done: boolean }[]>([]);
  const [newSub, setNewSub] = useState("");
  const [saving, setSaving] = useState(false);

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
      });
      setSubs(allSubs.filter((s) => s.task_id === task.id).map((s) => ({ id: s.id, title: s.title, done: s.done })));
    } else {
      setF(blank());
      setSubs([]);
    }
    setNewSub("");
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  const projectMilestones = useMemo(() => milestones.filter((m) => m.project_id === f.project_id), [milestones, f.project_id]);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) return void toast.error("Give the task a title");
    if (f.due_date && f.planned_date && f.planned_date > f.due_date) toast.warning("Heads up: planned work date is after the deadline");
    setSaving(true);
    try {
      const row = {
        title: f.title.trim().slice(0, 300), description: f.description || null, course_id: f.course_id || null,
        project_id: f.project_id || null, milestone_id: f.project_id && f.milestone_id ? f.milestone_id : null,
        task_type: f.task_type, status: f.status, priority: f.priority,
        due_at: f.due_date ? new Date(`${f.due_date}T${f.due_time || "23:59"}`).toISOString() : null,
        planned_date: f.planned_date || null,
        estimated_minutes: f.estimated_minutes ? Math.max(0, Math.min(10000, parseInt(f.estimated_minutes) || 0)) : null,
        tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20),
        recurrence: f.recurrence, completed_at: f.status === "done" ? task?.completed_at ?? new Date().toISOString() : null,
      };
      const res = task
        ? await supabase.from("tasks").update(row).eq("id", task.id).select().single()
        : await supabase.from("tasks").insert(row).select().single();
      if (res.error) throw res.error;
      const taskId = res.data.id;
      // Sync subtasks
      const existing = allSubs.filter((s) => s.task_id === taskId);
      const keepIds = new Set(subs.filter((s) => s.id).map((s) => s.id));
      const toDelete = existing.filter((s) => !keepIds.has(s.id)).map((s) => s.id);
      if (toDelete.length) await supabase.from("subtasks").delete().in("id", toDelete);
      for (const [i, s] of subs.entries()) {
        if (s.id) await supabase.from("subtasks").update({ title: s.title, done: s.done, position: i }).eq("id", s.id);
        else await supabase.from("subtasks").insert({ task_id: taskId, title: s.title, done: s.done, position: i });
      }
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["subtasks"] });
      toast.success(task ? "Task updated" : "Task added");
      onOpenChange(false);
    } catch (err) {
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
          <Input autoFocus placeholder="e.g. Chapter 7 reading questions" value={f.title} onChange={set("title")} className="h-11 text-base" />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Course">
              <select className={sel} value={f.course_id} onChange={set("course_id")}>
                <option value="">No course</option>
                {courses.filter((c) => !c.archived || c.id === f.course_id).map((c) => <option key={c.id} value={c.id}>{c.code ? `${c.code} · ` : ""}{c.name}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <select className={sel} value={f.task_type} onChange={set("task_type")}>
                {TASK_TYPES.map((t) => <option key={t} value={t}>{cap(t)}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select className={sel} value={f.priority} onChange={set("priority")}>
                {PRIORITIES.map((t) => <option key={t} value={t}>{cap(t)}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid gap-3 rounded-xl border border-border bg-muted/40 p-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs font-semibold text-destructive">Deadline (due)</Label>
              <div className="mt-1 flex gap-2">
                <Input type="date" value={f.due_date} onChange={set("due_date")} />
                <Input type="time" value={f.due_time} onChange={set("due_time")} className="w-28" disabled={!f.due_date} />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-primary">Plan to work on</Label>
              <Input type="date" className="mt-1" value={f.planned_date} onChange={set("planned_date")} />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">The deadline is when it's due. The work date is when you'll actually do it — that's what shows up in your Today list.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Status">
              <select className={sel} value={f.status} onChange={set("status")}>
                {STATUSES.map((t) => <option key={t} value={t}>{STATUS_LABEL[t]}</option>)}
              </select>
            </Field>
            <Field label="Est. minutes">
              <Input type="number" min={0} value={f.estimated_minutes} onChange={set("estimated_minutes")} />
            </Field>
            <Field label="Repeats">
              <select className={sel} value={f.recurrence} onChange={set("recurrence")}>
                {RECURRENCES.map((t) => <option key={t} value={t}>{t === "none" ? "Never" : cap(t)}</option>)}
              </select>
            </Field>
            <Field label="Tags">
              <Input placeholder="comma, separated" value={f.tags} onChange={set("tags")} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Project">
              <select className={sel} value={f.project_id} onChange={set("project_id")}>
                <option value="">None</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Milestone">
              <select className={sel} value={f.milestone_id} onChange={set("milestone_id")} disabled={!projectMilestones.length}>
                <option value="">None</option>
                {projectMilestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Notes">
            <Textarea rows={3} value={f.description} onChange={set("description")} placeholder="Instructions, links, anything useful" />
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
