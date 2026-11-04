import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { colorVar, useCourses, useTasks } from "@/lib/db";
import { CourseDialog } from "@/components/course-dialog";
import { CourseIcon } from "@/components/course-icon";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/courses/")({
  head: () => ({ meta: [{ title: "Courses — StudyOS" }, { name: "description", content: "Manage your classes, schedules and teachers." }] }),
  component: CoursesPage,
});

function CoursesPage() {
  const { data: courses = [], isLoading } = useCourses();
  const { data: tasks = [] } = useTasks();
  const [open, setOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const list = courses.filter((c) => showArchived || !c.archived);

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="mr-auto text-3xl font-bold">Courses</h1>
        <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Archived</label>
        <Button onClick={() => setOpen(true)}><Plus className="size-4" /> New course</Button>
      </div>
      {!isLoading && !list.length && (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="font-medium">Add your first class</p>
          <p className="mt-1 text-sm text-muted-foreground">Courses keep your tasks, exams and notes organised.</p>
          <Button className="mt-4" onClick={() => setOpen(true)}><Plus className="size-4" /> New course</Button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => {
          const open = tasks.filter((t) => t.course_id === c.id && t.status !== "done").length;
          return (
            <Link key={c.id} to="/courses/$courseId" params={{ courseId: c.id }} className="group overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-transform hover:-translate-y-0.5">
              <div className="h-2" style={{ background: colorVar(c.color) }} />
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 place-items-center rounded-xl" style={{ background: `color-mix(in oklab, ${colorVar(c.color)} 16%, transparent)`, color: colorVar(c.color) }}>
                    <CourseIcon name={c.icon} className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.name}</p>
                    <p className="text-sm text-muted-foreground">{[c.code, c.teacher].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">{open} open task{open === 1 ? "" : "s"}{c.semester ? ` · ${c.semester}` : ""}{c.archived ? " · archived" : ""}</p>
              </div>
            </Link>
          );
        })}
      </div>
      <CourseDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
