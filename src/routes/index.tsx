import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, CalendarDays, CheckSquare, GraduationCap, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StudyOS — Capture anywhere. Organize automatically." },
      { name: "description", content: "A private workspace for students: courses, assignments, exams and projects with separate deadlines and work dates." },
      { property: "og:title", content: "StudyOS — The student operating system" },
      { property: "og:description", content: "Courses, assignments, exams and projects in one calm, customizable workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: LayoutDashboard, title: "A dashboard you arrange", text: "Today, overdue, exams, workload — pick the widgets and order that fit how you study." },
  { icon: CalendarDays, title: "Deadline vs. work date", text: "Every task knows when it's due and when you plan to do it. Your Today list follows the plan." },
  { icon: CheckSquare, title: "List, board, calendar", text: "See your work the way you think: grouped by deadline, by status, or across the month." },
  { icon: BookOpen, title: "Courses that know you", text: "Colors, schedules, teachers and the nicknames you actually use for each class." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center px-6 py-5">
        <span className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><GraduationCap className="size-4" /></span>StudyOS
        </span>
        <Button asChild variant="ghost" className="ml-auto"><Link to="/auth">Sign in</Link></Button>
      </header>
      <section className="mx-auto max-w-4xl px-6 pb-16 pt-16 text-center md:pt-24">
        <p className="mb-4 inline-block rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">Built for high school & college</p>
        <h1 className="text-5xl font-bold leading-[1.05] md:text-7xl">Capture anywhere.<br /><span className="text-primary">Organize automatically.</span></h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">StudyOS is your private operating system for school — every class, assignment, exam and project in one place.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg"><Link to="/auth">Get started free</Link></Button>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, text }, i) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <span className="mb-4 grid size-10 place-items-center rounded-xl" style={{ background: `color-mix(in oklab, var(--chart-${i + 1}) 16%, transparent)`, color: `var(--chart-${i + 1})` }}><Icon className="size-5" /></span>
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
