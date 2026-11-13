import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Columns3, List, Plus } from "lucide-react";
import { useCourses, useProfile, useTasks, type Task } from "@/lib/db";
import { TaskDialog } from "@/components/task-dialog";
import { BoardView, CalendarView, ListView } from "@/components/task-views";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { QueryState } from "@/components/query-state";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Tasks — Pace" }, { name: "description", content: "All your tasks in list, board and calendar views." }, { property: "og:title", content: "Tasks — Pace" }, { property: "og:description", content: "All your tasks in list, board and calendar views." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: TasksPage,
});

const VIEWS = [
  { id: "list", label: "List", icon: List },
  { id: "board", label: "Board", icon: Columns3 },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
] as const;

function TasksPage() {
  const tasksQuery = useTasks();
  const coursesQuery = useCourses();
  const { data: tasks = [] } = tasksQuery;
  const { data: courses = [] } = coursesQuery;
  const { data: profile } = useProfile();
  const [view, setView] = useState<string>("list");
  const [courseFilter, setCourseFilter] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => { if (profile?.default_task_view) setView(profile.default_task_view); }, [profile?.default_task_view]);

  const courseMap = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const filtered = tasks.filter((t) => (!courseFilter || t.course_id === courseFilter) && (showDone || view === "board" || t.status !== "done"));

  if (tasksQuery.isLoading || coursesQuery.isLoading) return <QueryState loading loadingLabel="Loading your tasks…" />;
  if (tasksQuery.error || coursesQuery.error) return <QueryState error={tasksQuery.error ?? coursesQuery.error} onRetry={() => { void Promise.all([tasksQuery.refetch(), coursesQuery.refetch()]); }} />;

  return (
    <div>
      <div className="page-intro mb-8 flex flex-wrap items-end gap-3 border-b border-border/70 pb-6">
        <div className="mr-auto"><p className="overline-label mb-2">THE WORKBENCH</p><h1 className="text-5xl font-semibold">Tasks<span className="text-primary">.</span></h1><p className="mt-2 text-sm text-muted-foreground">Everything on your plate, brought into focus.</p></div>
        <div className="flex rounded-lg bg-muted p-0.5">
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <Button key={id} variant="ghost" aria-label={label} aria-pressed={view === id} onClick={() => setView(id)} className={cn("h-auto items-center gap-1.5 rounded-md px-3 py-1.5 text-sm", view === id ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>
              <Icon className="size-4" /> <span className="hidden sm:inline">{label}</span>
            </Button>
          ))}
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="size-4" /> New</Button>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <Select value={courseFilter || "__all__"} onValueChange={(value) => setCourseFilter(value === "__all__" ? "" : value)}>
          <SelectTrigger className="h-9 w-[min(100%,15rem)]"><SelectValue placeholder="All courses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All courses</SelectItem>
            {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.code || c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {view !== "board" && (
          <label className="flex items-center gap-2 text-muted-foreground">
            <Checkbox checked={showDone} onCheckedChange={(checked) => setShowDone(checked === true)} /> Show completed
          </label>
        )}
      </div>
      {view === "list" && <ListView tasks={filtered} courses={courseMap} onOpen={setEditing} timeZone={profile?.timezone} />}
      {view === "board" && <BoardView tasks={filtered} courses={courseMap} onOpen={setEditing} timeZone={profile?.timezone} />}
      {view === "calendar" && <CalendarView tasks={filtered} courses={courseMap} onOpen={setEditing} weekStartsOn={(profile?.week_starts_on ?? 1) as 0 | 1} timeZone={profile?.timezone} />}
      {(creating || editing) && <TaskDialog open={true} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }} task={editing} defaults={courseFilter ? { course_id: courseFilter } : undefined} />}
    </div>
  );
}
