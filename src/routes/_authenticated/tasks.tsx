import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Columns3, List, Plus } from "lucide-react";
import { useCourses, useProfile, useTasks, type Task } from "@/lib/db";
import { TaskDialog } from "@/components/task-dialog";
import { BoardView, CalendarView, ListView } from "@/components/task-views";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Tasks — StudyOS" }, { name: "description", content: "All your tasks in list, board and calendar views." }] }),
  component: TasksPage,
});

const VIEWS = [
  { id: "list", label: "List", icon: List },
  { id: "board", label: "Board", icon: Columns3 },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
] as const;

function TasksPage() {
  const { data: tasks = [] } = useTasks();
  const { data: courses = [] } = useCourses();
  const { data: profile } = useProfile();
  const [view, setView] = useState<string>("list");
  const [courseFilter, setCourseFilter] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => { if (profile?.default_task_view) setView(profile.default_task_view); }, [profile?.default_task_view]);

  const courseMap = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const filtered = tasks.filter((t) => (!courseFilter || t.course_id === courseFilter) && (showDone || view === "board" || t.status !== "done"));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-3xl font-bold">Tasks</h1>
        <div className="flex rounded-lg bg-muted p-0.5">
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setView(id)} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm", view === id ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>
              <Icon className="size-4" /> <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="size-4" /> New</Button>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <select className="h-9 rounded-md border border-input bg-background px-2" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
          <option value="">All courses</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.code || c.name}</option>)}
        </select>
        {view !== "board" && (
          <label className="flex items-center gap-2 text-muted-foreground">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show completed
          </label>
        )}
      </div>
      {view === "list" && <ListView tasks={filtered} courses={courseMap} onOpen={setEditing} />}
      {view === "board" && <BoardView tasks={filtered} courses={courseMap} onOpen={setEditing} />}
      {view === "calendar" && <CalendarView tasks={filtered} courses={courseMap} onOpen={setEditing} weekStartsOn={(profile?.week_starts_on ?? 1) as 0 | 1} />}
      <TaskDialog open={creating || !!editing} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }} task={editing} defaults={courseFilter ? { course_id: courseFilter } : undefined} />
    </div>
  );
}
