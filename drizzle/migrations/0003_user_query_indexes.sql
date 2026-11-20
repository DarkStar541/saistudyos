-- Query indexes for common per-user filters and relationship lookups.
-- Existing broad user_id indexes remain useful; these composites support the
-- actual filter combinations used by Pace's workspace and recurring-task queries.

CREATE INDEX IF NOT EXISTS projects_user_course_idx
  ON public.projects (user_id, course_id);

CREATE INDEX IF NOT EXISTS milestones_user_project_idx
  ON public.milestones (user_id, project_id);

CREATE INDEX IF NOT EXISTS subtasks_user_task_idx
  ON public.subtasks (user_id, task_id);

CREATE INDEX IF NOT EXISTS tasks_user_recurrence_date_idx
  ON public.tasks (user_id, recurrence_parent_id, planned_date)
  WHERE recurrence_parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tasks_user_status_idx
  ON public.tasks (user_id, status);

CREATE INDEX IF NOT EXISTS focus_sessions_user_kind_started_idx
  ON public.focus_sessions (user_id, kind, started_at DESC);
