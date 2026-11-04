import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BookOpen, CheckSquare, FolderKanban, LayoutDashboard, LogOut, Plus, Settings, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/db";
import { applyTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { TaskDialog } from "@/components/task-dialog";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/courses", label: "Courses", icon: BookOpen },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell() {
  const { data: profile } = useProfile();
  const [addOpen, setAddOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (profile?.theme) applyTheme(profile.theme);
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

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <Link to="/dashboard" className="mb-8 flex items-center gap-2 px-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-4" />
          </span>
          <span className="font-display text-lg font-bold">StudyOS</span>
        </Link>
        <Button className="mb-6 justify-start gap-2" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" /> New task
          <kbd className="ml-auto rounded bg-primary-foreground/20 px-1.5 text-xs">N</kbd>
        </Button>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
            >
              <Icon className="size-4" /> {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border pt-3">
          <p className="truncate px-3 text-sm font-medium">{profile?.display_name ?? "Student"}</p>
          <button onClick={signOut} className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>

      <main className="pb-24 md:pb-0 md:pl-60">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav + floating add */}
      <button
        aria-label="New task"
        onClick={() => setAddOpen(true)}
        className="fixed bottom-20 right-4 z-30 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-card md:hidden"
      >
        <Plus className="size-6" />
      </button>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-card/95 backdrop-blur md:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground" activeProps={{ className: "text-primary" }}>
            <Icon className="size-5" /> {label}
          </Link>
        ))}
      </nav>

      <TaskDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
