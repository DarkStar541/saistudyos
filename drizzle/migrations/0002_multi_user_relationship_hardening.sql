-- Multi-user ownership hardening.
-- RLS protects row visibility; these triggers also prevent a user from
-- attaching their own rows to another user's courses, projects, milestones or tasks.

CREATE OR REPLACE FUNCTION public.enforce_workspace_relationships()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  related_project_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'projects' THEN
    IF NEW.course_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = NEW.course_id AND c.user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Project course must belong to the same user'
        USING ERRCODE = '23514';
    END IF;

  ELSIF TG_TABLE_NAME = 'milestones' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = NEW.project_id AND p.user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Milestone project must belong to the same user'
        USING ERRCODE = '23514';
    END IF;

  ELSIF TG_TABLE_NAME = 'tasks' THEN
    IF NEW.course_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = NEW.course_id AND c.user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Task course must belong to the same user'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.project_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = NEW.project_id AND p.user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Task project must belong to the same user'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.milestone_id IS NOT NULL THEN
      SELECT m.project_id INTO related_project_id
      FROM public.milestones m
      WHERE m.id = NEW.milestone_id AND m.user_id = NEW.user_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Task milestone must belong to the same user'
          USING ERRCODE = '23514';
      END IF;

      IF NEW.project_id IS NOT NULL AND NEW.project_id <> related_project_id THEN
        RAISE EXCEPTION 'Task milestone must belong to its selected project'
          USING ERRCODE = '23514';
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'focus_sessions' THEN
    IF NEW.task_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = NEW.task_id AND t.user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Focus session task must belong to the same user'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.course_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = NEW.course_id AND c.user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Focus session course must belong to the same user'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER projects_enforce_workspace_relationships
  BEFORE INSERT OR UPDATE OF user_id, course_id ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_relationships();

CREATE TRIGGER milestones_enforce_workspace_relationships
  BEFORE INSERT OR UPDATE OF user_id, project_id ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_relationships();

CREATE TRIGGER tasks_enforce_workspace_relationships
  BEFORE INSERT OR UPDATE OF user_id, course_id, project_id, milestone_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_relationships();

CREATE TRIGGER focus_sessions_enforce_workspace_relationships
  BEFORE INSERT OR UPDATE OF user_id, task_id, course_id ON public.focus_sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_relationships();

-- Query caches are cleared on account changes in the client as a second
-- boundary; RLS remains the authoritative data-access control.
