import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BookOpen, CalendarDays, CheckSquare, Clock3, FolderKanban, LayoutDashboard, LogOut, Plus, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/db";
import { applyTheme, applyStyle, getSavedStyle } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { TaskDialog } from "@/components/task-dialog";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/focus", label: "Focus", icon: Clock3 },
  { to: "/courses", label: "Courses", icon: BookOpen },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function Wordmark() {
  return (
    <Link to="/dashboard" className="flex items-center gap-2.5 px-2">
      <span className="app-wordmark-mark grid size-8 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">P</span>
      <span className="text-lg font-semibold tracking-tight">Pace</span>
    </Link>
  );
}

export function AppShell() {
  const { data: profile } = useProfile();
  const [addOpen, setAddOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (profile?.theme) applyTheme(profile.theme);
    applyStyle(getSavedStyle());
  }, [profile?.theme]);

  // Keep system mode in sync if the operating system theme changes mid-session.
  useEffect(() => {
    if (profile?.theme !== "system") return undefined;
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => applyTheme("system");
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, [profile?.theme]);

  // Keyboard shortcut: "n" opens new task (ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input,textarea,select,[contenteditable=true]")) return;
      if (e.key === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setAddOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initial = (profile?.display_name ?? "P").trim().charAt(0).toUpperCase() || "P";

  return (
    <div className="min-h-screen bg-background">
      <aside className="app-sidebar fixed inset-y-0 left-0 hidden w-[15.5rem] flex-col overflow-y-auto overscroll-contain px-5 py-7 lg:flex">
        <Wordmark />
        <Button className="app-new-task-button mt-9 h-11 justify-start gap-2 rounded-xl shadow-card" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" /> New task
          <kbd className="ml-auto rounded bg-primary-foreground/20 px-1.5 text-xs">N</kbd>
        </Button>
        <div className="mt-10 mb-2 px-3"><p className="text-xs font-medium text-muted-foreground">Workspace</p></div>
        <nav className="mt-3 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="app-nav-link flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              activeProps={{ className: "bg-sidebar-accent font-semibold text-sidebar-accent-foreground" }}
            >
              <Icon className="size-4" /> {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 border-t border-sidebar-border pt-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent font-display text-sm font-semibold text-accent-foreground">
            {initial}
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{profile?.display_name ?? "Student"}</p>
          <button
            onClick={signOut}
            aria-label="Sign out"
            className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      <main className="app-main page-wash pb-24 lg:pb-0 lg:pl-[15.5rem]">
        <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-10 lg:py-10 xl:px-14">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav + floating add */}
      <button
        aria-label="New task"
        onClick={() => setAddOpen(true)}
        className="app-mobile-add fixed bottom-20 right-4 z-30 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lift lg:hidden"
      >
        <Plus className="size-6" />
      </button>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-7 border-t border-border bg-card/90 backdrop-blur-md lg:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground" activeProps={{ className: "font-semibold text-primary" }}>
            <Icon className="size-5" /> {label}
          </Link>
        ))}
      </nav>

      {addOpen && <TaskDialog open={addOpen} onOpenChange={setAddOpen} />}
    </div>
  );
}
