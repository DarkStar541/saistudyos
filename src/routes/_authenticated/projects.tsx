import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { colorVar, useCourses, useMilestones, useProjects, useRemove, useSave, useTasks, type Project, type Task } from "@/lib/db";
import { TaskDialog } from "@/components/task-dialog";
import { TaskRow } from "@/components/task-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/date-picker";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({ meta: [{ title: "Projects — StudyOS" }, { name: "description", content: "Break big work into milestones and tasks." }, { property: "og:title", content: "Projects — StudyOS" }, { property: "og:description", content: "Break big work into milestones and tasks." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { data: projects = [] } = useProjects();
  const { data: courses = [] } = useCourses();
  const { data: tasks = [] } = useTasks();
  const { data: milestones = [] } = useMilestones();
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const courseMap = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const tasksByProject = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    for (const task of tasks) if (task.project_id) grouped.set(task.project_id, [...(grouped.get(task.project_id) ?? []), task]);
    return grouped;
  }, [tasks]);
  const milestonesByProject = useMemo(() => {
    const grouped = new Map<string, typeof milestones>();
    for (const milestone of milestones) grouped.set(milestone.project_id, [...(grouped.get(milestone.project_id) ?? []), milestone]);
    return grouped;
  }, [milestones]);

  return (
    <div>
      <div className="page-intro mb-8 flex items-end border-b border-border/70 pb-6">
        <div className="mr-auto"><p className="overline-label mb-2">LONGER HORIZONS</p><h1 className="text-5xl font-semibold">Projects<span className="text-primary">.</span></h1><p className="mt-2 text-sm text-muted-foreground">Big goals, broken into meaningful next steps.</p></div>
        <Button onClick={() => setCreating(true)}><Plus className="size-4" /> New project</Button>
      </div>
      {!projects.length && (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="font-medium">No projects yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Use projects for essays, labs, and anything with several steps.</p>
        </div>
      )}
      <div className="space-y-3">
        {projects.map((p) => {
          const pt = tasksByProject.get(p.id) ?? [];
          const pm = milestonesByProject.get(p.id) ?? [];
          const total = pt.length + pm.length;
          const done = pt.filter((t) => t.status === "done").length + pm.filter((m) => m.done).length;
          const course = p.course_id ? courseMap.get(p.course_id) : undefined;
          return (
            <div key={p.id} className="rounded-2xl border border-border bg-card shadow-card">
              <button onClick={() => setOpenId(openId === p.id ? null : p.id)} className="flex w-full items-center gap-4 p-4 text-left">
                <span className="h-10 w-1 rounded-full" style={{ background: course ? colorVar(course.color) : "var(--primary)" }} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {[course?.name, p.due_at && `Due ${format(new Date(p.due_at), "MMM d")}`, p.status !== "active" && p.status].filter(Boolean).join(" · ") || "No deadline"}
                  </p>
                </div>
                <div className="hidden w-40 sm:block">
                  <Progress value={total ? (done / total) * 100 : 0} />
                  <p className="mt-1 text-right text-xs text-muted-foreground">{done}/{total}</p>
                </div>
                <ChevronDown className={cn("size-4 transition-transform", openId === p.id && "rotate-180")} />
              </button>
              {openId === p.id && <ProjectDetail project={p} tasks={pt} courses={courseMap} />}
            </div>
          );
        })}
      </div>
      <ProjectDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function ProjectDetail({ project, tasks, courses }: { project: Project; tasks: Task[]; courses: Map<string, import("@/lib/db").Course> }) {
  const { data: milestones = [] } = useMilestones();
  const saveM = useSave("milestones");
  const removeM = useRemove("milestones");
  const saveP = useSave("projects");
  const removeP = useRemove("projects");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [taskOpen, setTaskOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const ms = milestones.filter((m) => m.project_id === project.id);

  return (
    <div className="grid gap-6 border-t border-border p-4 md:grid-cols-2">
      <div>
        {project.description && <p className="mb-3 text-sm text-muted-foreground">{project.description}</p>}
        <h3 className="mb-2 text-sm font-semibold">Milestones</h3>
        <div className="space-y-1">
          {ms.map((m) => (
            <div key={m.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60">
              <Checkbox checked={m.done} onCheckedChange={(v) => saveM.mutate({ id: m.id, done: !!v })} />
              <span className={cn("flex-1 text-sm", m.done && "line-through opacity-60")}>{m.title}</span>
              {m.due_at && <span className="text-xs text-muted-foreground">{format(new Date(m.due_at), "MMM d")}</span>}
              <button onClick={() => removeM.mutate(m.id)} aria-label="Remove milestone"><Trash2 className="size-3.5 text-muted-foreground" /></button>
            </div>
          ))}
        </div>
        <form className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto]" onSubmit={async (e) => { e.preventDefault(); if (!title.trim()) return; await saveM.mutateAsync({ project_id: project.id, title: title.trim(), due_at: date ? new Date(`${date}T23:59`).toISOString() : null, position: ms.length }); setTitle(""); setDate(""); }}>
          <Input className="h-9 w-full min-w-0" placeholder="New milestone" value={title} onChange={(e) => setTitle(e.target.value)} />
          <DatePicker value={date} onChange={setDate} placeholder="Milestone date" className="h-9" />
          <Button size="sm" type="submit">Add</Button>
        </form>
        <div className="mt-6 flex gap-2">
          <Select value={project.status} onValueChange={(value) => saveP.mutate({ id: project.id, status: value })}>
            <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="on_hold">On hold</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent>
          </Select>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm(`Delete "${project.name}"? Its tasks are kept.`)) removeP.mutate(project.id); }}><Trash2 className="size-4" /> Delete project</Button>
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Tasks</h3>
          <Button size="sm" variant="ghost" onClick={() => setTaskOpen(true)}><Plus className="size-4" /> Task</Button>
        </div>
        {tasks.length ? tasks.map((t) => <TaskRow key={t.id} task={t} course={t.course_id ? courses.get(t.course_id) : undefined} onOpen={setEditing} compact />) : <p className="text-sm text-muted-foreground">No tasks linked yet.</p>}
      </div>
      {(taskOpen || editing) && <TaskDialog open={true} onOpenChange={(o) => { if (!o) { setTaskOpen(false); setEditing(null); } }} task={editing} defaults={{ project_id: project.id, course_id: project.course_id }} />}
    </div>
  );
}

function ProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: courses = [] } = useCourses();
  const save = useSave("projects");
  const [f, setF] = useState({ name: "", description: "", course_id: "", due: "" });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New project</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          if (!f.name.trim()) return void toast.error("Name your project");
          await save.mutateAsync({ name: f.name.trim(), description: f.description || null, course_id: f.course_id || null, due_at: f.due ? new Date(`${f.due}T23:59`).toISOString() : null });
          setF({ name: "", description: "", course_id: "", due: "" });
          onOpenChange(false);
        }}>
          <div className="space-y-1"><Label className="text-xs">Name</Label><Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="History research paper" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Course</Label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={f.course_id} onChange={(e) => setF({ ...f, course_id: e.target.value })}>
                <option value="">None</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            <div className="space-y-1"><Label className="text-xs">Final deadline</Label><DatePicker value={f.due} onChange={(value) => setF({ ...f, due: value })} placeholder="Final deadline" /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Description</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit">Create</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
