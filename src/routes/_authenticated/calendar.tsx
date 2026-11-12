import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarView } from "@/components/task-views";
import { TaskDialog } from "@/components/task-dialog";
import { useCourses, useProfile, useTasks, type Task } from "@/lib/db";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — StudyOS" },
      { name: "description", content: "See your assignments and planned work across the coming weeks and months." },
    ],
  }),
  component: CalendarPage,
});

function CalendarPage() {
  const { data: tasks = [] } = useTasks();
  const { data: courses = [] } = useCourses();
  const { data: profile } = useProfile();
  const [showCompleted, setShowCompleted] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const courseMap = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
  const visibleTasks = useMemo(
    () => tasks.filter((task) => showCompleted || task.status !== "done"),
    [tasks, showCompleted],
  );

  return (
    <div>
      <div className="page-intro mb-6 flex flex-wrap items-end gap-3 border-b border-border/70 pb-6">
        <div className="mr-auto">
          <p className="overline-label mb-2">LONG-TERM VIEW</p>
          <h1 className="text-5xl font-semibold">Calendar<span className="text-primary">.</span></h1>
          <p className="mt-2 text-sm text-muted-foreground">Plan ahead. See deadlines and work across the months ahead.</p>
        </div>
        <Button variant={showCompleted ? "default" : "outline"} size="sm" onClick={() => setShowCompleted((value) => !value)} aria-pressed={showCompleted}>
          {showCompleted ? "Hide completed" : "Show completed"}
        </Button>
      </div>
      <CalendarView
        tasks={visibleTasks}
        courses={courseMap}
        onOpen={setEditing}
        weekStartsOn={(profile?.week_starts_on ?? 1) as 0 | 1}
        timeZone={profile?.timezone}
      />
      {editing && (
        <TaskDialog
          open={true}
          onOpenChange={(open) => { if (!open) setEditing(null); }}
          task={editing}
        />
      )}
    </div>
  );
}
