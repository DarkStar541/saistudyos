import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { colorVar, useCourses, useTasks } from "@/lib/db";
import { CourseDialog } from "@/components/course-dialog";
import { CourseIcon } from "@/components/course-icon";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/courses/")({
  head: () => ({ meta: [{ title: "Courses — StudyOS" }, { name: "description", content: "Manage your classes, schedules and teachers." }, { property: "og:title", content: "Courses — StudyOS" }, { property: "og:description", content: "Manage your classes, schedules and teachers." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: CoursesPage,
});

function CoursesPage() {
  const { data: courses = [], isLoading } = useCourses();
  const { data: tasks = [] } = useTasks();
  const [open, setOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const list = courses.filter((c) => showArchived || !c.archived);
  const openTaskCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of tasks) {
      if (task.course_id && task.status !== "done") counts.set(task.course_id, (counts.get(task.course_id) ?? 0) + 1);
    }
    return counts;
  }, [tasks]);

  return (
    <div>
      <div className="page-intro mb-8 flex flex-wrap items-end gap-3 border-b border-border/70 pb-6">
        <div className="mr-auto"><p className="overline-label mb-2">YOUR ACADEMIC LANDSCAPE</p><h1 className="text-5xl font-semibold">Courses<span className="text-primary">.</span></h1><p className="mt-2 text-sm text-muted-foreground">Every class, its work, and the semester ahead.</p></div>
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
          const open = openTaskCounts.get(c.id) ?? 0;
          return (
            <Link key={c.id} to="/courses/$courseId" params={{ courseId: c.id }} className="course-card group overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-transform hover:-translate-y-0.5">
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
