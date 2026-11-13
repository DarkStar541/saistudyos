import { useState } from "react";
import { Sparkles, WandSparkles, Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCourses, useProfile, useSave } from "@/lib/db";
import { dateTimeInTimeZoneToIso, PRIORITIES, TASK_TYPES } from "@/lib/task-utils";
import { aiQuickAddProposalSchema, type AiQuickAddProposal } from "@/lib/ai-quick-add";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Proposal = AiQuickAddProposal;

const NONE = "__none__";
const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).replace("_", " ");

export function AiQuickAdd() {
  const { data: courses = [] } = useCourses();
  const { data: profile } = useProfile();
  const save = useSave("tasks");
  const [capture, setCapture] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function parseCapture(event: React.FormEvent) {
    event.preventDefault();
    if (!capture.trim() || parsing) return;
    setParsing(true);
    setProposal(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-quick-add", {
        body: { text: capture.trim() },
      });
      if (error) throw new Error(data?.error || error.message || "Couldn't interpret that capture.");
      const validated = aiQuickAddProposalSchema.safeParse(data?.proposal);
      if (!validated.success) throw new Error(data?.error || "The AI returned an invalid proposal. Try again.");
      setProposal(validated.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI Quick Add is unavailable.");
    } finally {
      setParsing(false);
    }
  }

  async function confirmProposal(event: React.FormEvent) {
    event.preventDefault();
    if (!proposal || saving) return;
    if (!proposal.title.trim()) return void toast.error("Add a task title before saving.");
    if (proposal.courseUnresolved) return void toast.error("Choose the correct course before saving.");
    setSaving(true);
    try {
      await save.mutateAsync({
        title: proposal.title.trim().slice(0, 300),
        description: proposal.description?.trim() || null,
        course_id: proposal.courseId || null,
        project_id: null,
        milestone_id: null,
        task_type: proposal.taskType,
        status: "todo",
        priority: proposal.priority,
        due_at: proposal.dueDate
          ? dateTimeInTimeZoneToIso(proposal.dueDate, proposal.dueTime || "23:59", profile?.timezone)
          : null,
        planned_date: proposal.plannedDate,
        estimated_minutes: proposal.estimatedMinutes,
        tags: [],
        recurrence: "none",
        recurrence_interval: 1,
        recurrence_days: null,
        recurrence_end: null,
        completed_at: null,
      });
      toast.success("Task added to Pace");
      setCapture("");
      setProposal(null);
    } catch {
      // useSave reports the database error; keep the proposal intact for retry.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={parseCapture} className="space-y-2">
        <Textarea
          value={capture}
          onChange={(event) => setCapture(event.target.value.slice(0, 500))}
          maxLength={500}
          rows={2}
          placeholder='Try: "Physics lab due Friday, work on it Thursday"'
          aria-label="Describe the task you want to add"
          className="min-h-20 resize-y"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">{capture.length}/500 · Nothing is saved until you confirm</span>
          <Button type="submit" disabled={!capture.trim() || parsing} size="sm">
            <WandSparkles className="size-4" />
            {parsing ? "Thinking…" : "Create proposal"}
          </Button>
        </div>
      </form>

      {proposal && (
        <form onSubmit={confirmProposal} className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-4 text-primary" />
            Review your task
          </div>
          {proposal.clarificationQuestion && (
            <p className="rounded-lg border border-primary/25 bg-primary/5 p-2.5 text-sm">{proposal.clarificationQuestion}</p>
          )}
          <Input value={proposal.title} onChange={(event) => setProposal({ ...proposal, title: event.target.value })} aria-label="Task title" maxLength={300} />
          <div className="grid gap-2 sm:grid-cols-3">
            <Select value={proposal.courseId || NONE} onValueChange={(value) => setProposal({
              ...proposal,
              courseId: value === NONE ? null : value,
              courseName: value === NONE ? null : courses.find((course) => course.id === value)?.name ?? null,
              courseUnresolved: false,
            })}>
              <SelectTrigger aria-label="Course"><SelectValue placeholder="Course" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No course</SelectItem>
                {courses.filter((course) => !course.archived).map((course) => (
                  <SelectItem key={course.id} value={course.id}>{course.code ? course.code + " · " : ""}{course.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={proposal.taskType} onValueChange={(value) => setProposal({ ...proposal, taskType: value })}>
              <SelectTrigger aria-label="Task type"><SelectValue /></SelectTrigger>
              <SelectContent>{TASK_TYPES.map((type) => <SelectItem key={type} value={type}>{label(type)}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={proposal.priority} onValueChange={(value) => setProposal({ ...proposal, priority: value })}>
              <SelectTrigger aria-label="Priority"><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{label(priority)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="space-y-1 text-xs text-muted-foreground">Deadline
              <Input type="date" value={proposal.dueDate ?? ""} onChange={(event) => setProposal({ ...proposal, dueDate: event.target.value || null })} />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">Work date
              <Input type="date" value={proposal.plannedDate ?? ""} onChange={(event) => setProposal({ ...proposal, plannedDate: event.target.value || null })} />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">Estimated minutes
              <Input type="number" min={0} max={10000} value={proposal.estimatedMinutes ?? ""} onChange={(event) => setProposal({ ...proposal, estimatedMinutes: event.target.value ? Math.max(0, Math.min(10000, Number(event.target.value))) : null })} />
            </label>
          </div>
          {proposal.dueDate && (
            <label className="block space-y-1 text-xs text-muted-foreground">Deadline time
              <Input type="time" value={proposal.dueTime ?? "23:59"} onChange={(event) => setProposal({ ...proposal, dueTime: event.target.value || "23:59" })} />
            </label>
          )}
          <Textarea rows={2} value={proposal.description ?? ""} onChange={(event) => setProposal({ ...proposal, description: event.target.value || null })} placeholder="Description (optional)" aria-label="Task description" />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setProposal(null)} disabled={saving}><RotateCcw className="size-3.5" /> Discard</Button>
            <Button type="submit" size="sm" disabled={saving || proposal.courseUnresolved}><Check className="size-4" /> {saving ? "Saving…" : "Confirm and add task"}</Button>
          </div>
        </form>
      )}
    </div>
  );
}
