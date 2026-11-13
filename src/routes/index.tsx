import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  ListTodo,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pace — Make room for what matters." },
      { name: "description", content: "A calmer way to manage classes, assignments, projects, deadlines and focus." },
      { property: "og:title", content: "Pace — Make room for what matters." },
      { property: "og:description", content: "Bring your classes, tasks, projects and schedule into one clear workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: ListTodo,
    title: "Know what needs doing",
    text: "Keep assignments, small tasks and bigger projects in one organized place.",
  },
  {
    icon: CalendarDays,
    title: "Plan the work, not just the deadline",
    text: "Separate when something is due from when you intend to work on it.",
  },
  {
    icon: BookOpen,
    title: "Keep every class in context",
    text: "Organize tasks by course, with schedules and details close at hand.",
  },
  {
    icon: Clock3,
    title: "Make time for focused work",
    text: "Use focus sessions to give important work your attention and track your progress.",
  },
];

function Brand() {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5" aria-label="Pace home">
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">P</span>
      <span className="text-xl font-semibold tracking-tight">Pace</span>
    </Link>
  );
}

function DashboardPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[570px]">
      <div className="absolute -inset-5 -z-10 rounded-[2rem] bg-muted/70 blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_80px_-35px_rgba(0,0,0,0.28)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">P</span>
            <span className="text-sm font-semibold">Your workspace</span>
          </div>
          <span className="text-xs text-muted-foreground">MONDAY, 12 OCT</span>
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">YOUR DAY</p>
              <h3 className="mt-1 text-3xl font-semibold tracking-tight">A clear start.</h3>
              <p className="mt-1 text-sm text-muted-foreground">A little progress adds up.</p>
            </div>
            <div className="rounded-xl bg-muted px-3 py-2 text-right">
              <p className="text-xl font-semibold tabular-nums">3</p>
              <p className="text-[11px] text-muted-foreground">tasks today</p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border p-3"><p className="text-xl font-semibold">03</p><p className="mt-1 text-[11px] text-muted-foreground">Planned</p></div>
            <div className="rounded-xl border border-border p-3"><p className="text-xl font-semibold">01</p><p className="mt-1 text-[11px] text-muted-foreground">Completed</p></div>
            <div className="rounded-xl border border-border p-3"><p className="text-xl font-semibold">45m</p><p className="mt-1 text-[11px] text-muted-foreground">Focused</p></div>
          </div>
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold">Up next</p><span className="text-xs text-muted-foreground">Your plan</span></div>
            <div className="space-y-2.5">
              {[
                ["Review chapter notes", "Biology · 9:30 AM", true],
                ["Finish problem set", "Mathematics · 11:00 AM", false],
                ["Project research", "History · 2:00 PM", false],
              ].map(([title, detail, done]) => (
                <div key={String(title)} className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-3">
                  <span className={`grid size-5 shrink-0 place-items-center rounded-full border ${done ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{done ? <Check className="size-3" /> : null}</span>
                  <div className="min-w-0 flex-1"><p className={`truncate text-sm font-medium ${done ? "text-muted-foreground line-through" : ""}`}>{title}</p><p className="mt-0.5 text-xs text-muted-foreground">{detail}</p></div>
                  <span className="text-xs text-muted-foreground">{done ? "Done" : "Task"}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-xl bg-muted/70 px-3.5 py-3 text-xs text-muted-foreground">
            <Sparkles className="size-4 shrink-0" />
            One workspace for the things you need to keep moving.
          </div>
        </div>
      </div>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Brand />
        <nav className="flex items-center gap-2">
          <a href="#features" className="hidden rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex">Features</a>
          <Button asChild variant="ghost" size="sm"><Link to="/auth">Sign in</Link></Button>
          <Button asChild size="sm" className="rounded-full px-4"><Link to="/auth">Get started <ArrowRight className="ml-1.5 size-3.5" /></Link></Button>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-12 sm:px-8 md:pt-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12 lg:px-12 lg:pb-28">
          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" />
              A calmer way to stay on top of school
            </div>
            <h1 className="text-5xl font-semibold leading-[1.04] tracking-[-0.055em] sm:text-6xl lg:text-[4.5rem]">
              Make room for
              <span className="block text-primary">what matters.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Classes, assignments, projects and plans — together in one clear space. Spend less time keeping track, and more time moving forward.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 rounded-full px-6">
                <Link to="/auth">Get started <ArrowRight className="ml-2 size-4" /></Link>
              </Button>
              <a href="#features" className="inline-flex h-12 items-center rounded-full px-5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Explore Pace</a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5" /> Built around your workflow</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5" /> Your courses, your plan</span>
            </div>
          </div>
          <DashboardPreview />
        </section>

        <section id="features" className="border-y border-border bg-card/55">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-24">
            <div className="max-w-2xl">
              <p className="overline-label">A LITTLE MORE CLARITY</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Everything has its place.</h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">A useful workspace should make the next step easier to see — without getting in your way.</p>
            </div>
            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <article key={title} className="border-t border-border pt-5">
                  <span className="grid size-10 place-items-center rounded-xl bg-muted text-foreground"><Icon className="size-5" /></span>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 py-20 sm:px-8 md:flex-row md:items-center lg:px-12 lg:py-24">
          <div className="max-w-2xl">
            <p className="overline-label">START WITH A CLEARER PLAN</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Your work, in one place.</h2>
            <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">Set up your courses, capture what needs doing, and build a plan that works for you.</p>
          </div>
          <Button asChild size="lg" className="h-12 shrink-0 rounded-full px-6">
            <Link to="/auth">Create your workspace <ArrowRight className="ml-2 size-4" /></Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <Brand />
          <p>Make room for what matters.</p>
          <p>© {new Date().getFullYear()} Pace</p>
        </div>
      </footer>
    </div>
  );
}
