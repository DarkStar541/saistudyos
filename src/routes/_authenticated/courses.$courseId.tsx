import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Archive, FileUp, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { colorVar, useCourses, useRemove, useSave, useTasks, type Task } from "@/lib/db";
import { CourseDialog, DAY_NAMES, type Slot } from "@/components/course-dialog";
import { CourseIcon } from "@/components/course-icon";
import { TaskDialog } from "@/components/task-dialog";
import { TaskRow } from "@/components/task-row";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/courses/$courseId")({
  head: () => ({ meta: [{ title: "Course — StudyOS" }, { name: "description", content: "Course details, assignments, exams and notes." }] }),
  component: CoursePage,
});

function CoursePage() {
  const { courseId } = Route.useParams();
  const { data: courses = [], isLoading } = useCourses();
  const { data: tasks = [] } = useTasks();
  const course = courses.find((c) => c.id === courseId);
  const save = useSave("courses");
  const remove = useRemove("courses");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [taskOpen, setTaskOpen] = useState<null | "assignment" | "exam">(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => { setNotes(course?.notes ?? ""); }, [course?.id, course?.notes]);
  // Track "recently accessed" for the dashboard widget.
  useEffect(() => {
    if (!course) return;
    // Fire-and-forget; no invalidation — the dashboard re-sorts on its next fresh fetch.
    void supabase.from("courses").update({ last_accessed_at: new Date().toISOString() }).eq("id", course.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.id]);

  const mine = useMemo(() => tasks.filter((t) => t.course_id === courseId), [tasks, courseId]);
  const exams = mine.filter((t) => ["exam", "quiz"].includes(t.task_type) && t.status !== "done");
  const work = mine.filter((t) => !["exam", "quiz"].includes(t.task_type) && t.status !== "done");
  const done = mine.filter((t) => t.status === "done");

  if (isLoading) return null;
  if (!course) return <p className="text-muted-foreground">Course not found. <Link to="/courses" className="text-primary underline">Back to courses</Link></p>;
  const schedule = (course.schedule as Slot[]) ?? [];

  return (
    <div>
      <Link to="/courses" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Courses</Link>
      <div className="mb-6 flex flex-wrap items-start gap-4">
        <span className="grid size-14 place-items-center rounded-2xl" style={{ background: `color-mix(in oklab, ${colorVar(course.color)} 18%, transparent)`, color: colorVar(course.color) }}>
          <CourseIcon name={course.icon} className="size-7" />
        </span>
        <div className="mr-auto">
          <h1 className="text-3xl font-bold">{course.name}</h1>
          <p className="text-muted-foreground">{[course.code, course.teacher, course.semester].filter(Boolean).join(" · ")}</p>
          {!!course.aliases.length && <p className="mt-1 text-xs text-muted-foreground">Also known as: {course.aliases.join(", ")}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEdit(true)}><Pencil className="size-4" /> Edit</Button>
          <Button variant="outline" size="sm" onClick={() => save.mutate({ id: course.id, archived: !course.archived })}><Archive className="size-4" /> {course.archived ? "Unarchive" : "Archive"}</Button>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmDel(true)}><Trash2 className="size-4" /></Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Upcoming exams" action={<Button size="sm" variant="ghost" onClick={() => setTaskOpen("exam")}><Plus className="size-4" /> Exam</Button>}>
            {exams.length ? exams.map((t) => <TaskRow key={t.id} task={t} course={course} onOpen={setEditing} compact />) : <p className="px-3 py-2 text-sm text-muted-foreground">No exams scheduled.</p>}
          </Section>
          <Section title="Assignments & tasks" action={<Button size="sm" variant="ghost" onClick={() => setTaskOpen("assignment")}><Plus className="size-4" /> Task</Button>}>
            {work.length ? work.map((t) => <TaskRow key={t.id} task={t} course={course} onOpen={setEditing} />) : <p className="px-3 py-2 text-sm text-muted-foreground">All caught up.</p>}
          </Section>
          {!!done.length && (
            <Section title={`Completed · ${done.length}`}>{done.slice(0, 10).map((t) => <TaskRow key={t.id} task={t} course={course} onOpen={setEditing} compact />)}</Section>
          )}
        </div>
        <div className="space-y-6">
          <Section title="Schedule">
            {schedule.length ? (
              <ul className="space-y-1 px-3 py-1 text-sm">
                {schedule.slice().sort((a, b) => a.day - b.day || a.start.localeCompare(b.start)).map((s, i) => (
                  <li key={i} className="flex justify-between"><span className="font-medium">{DAY_NAMES[s.day]}</span><span className="text-muted-foreground">{s.start}–{s.end}{s.location ? ` · ${s.location}` : ""}</span></li>
                ))}
              </ul>
            ) : <p className="px-3 py-2 text-sm text-muted-foreground">No class times yet.</p>}
          </Section>
          <Section title="Course notes">
            <div className="p-2">
              <Textarea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Grading policy, office hours, anything…" />
              <Button size="sm" className="mt-2" disabled={notes === (course.notes ?? "")} onClick={async () => { await save.mutateAsync({ id: course.id, notes }); toast.success("Notes saved"); }}>Save notes</Button>
            </div>
          </Section>
          <Section title="Resources">
            <p className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground"><FileUp className="size-4" /> File uploads open with the Knowledge Library (Stage 4).</p>
          </Section>
        </div>
      </div>

      <CourseDialog open={edit} onOpenChange={setEdit} course={course} />
      <TaskDialog open={!!taskOpen || !!editing} onOpenChange={(o) => { if (!o) { setTaskOpen(null); setEditing(null); } }} task={editing} defaults={{ course_id: course.id, task_type: taskOpen ?? "assignment" }} />
      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {course.name}?</AlertDialogTitle>
            <AlertDialogDescription>Its tasks stay, but lose their course link. Archiving keeps everything instead.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { await remove.mutateAsync(course.id); qc.invalidateQueries({ queryKey: ["tasks"] }); navigate({ to: "/courses" }); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-2 shadow-card">
      <div className="flex items-center justify-between px-3 py-1.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
