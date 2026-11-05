ALTER TABLE public.tasks ADD COLUMN recurrence_interval integer NOT NULL DEFAULT 1;
ALTER TABLE public.tasks ADD COLUMN recurrence_days integer[];
ALTER TABLE public.tasks ADD COLUMN recurrence_end date;
ALTER TABLE public.tasks ADD COLUMN recurrence_parent_id uuid;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_recurrence_interval_check CHECK (recurrence_interval BETWEEN 1 AND 365);
CREATE INDEX tasks_recurrence_parent_idx ON public.tasks (recurrence_parent_id);

CREATE TABLE public.focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'focus' CHECK (kind IN ('focus', 'short_break', 'long_break')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  planned_seconds integer NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.focus_sessions TO authenticated;
GRANT ALL ON public.focus_sessions TO service_role;
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own focus sessions" ON public.focus_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX focus_sessions_user_started_idx ON public.focus_sessions (user_id, started_at);

ALTER TABLE public.profiles ADD COLUMN focus_minutes integer NOT NULL DEFAULT 25;
ALTER TABLE public.profiles ADD COLUMN short_break_minutes integer NOT NULL DEFAULT 5;
ALTER TABLE public.profiles ADD COLUMN long_break_minutes integer NOT NULL DEFAULT 15;
ALTER TABLE public.profiles ADD COLUMN long_break_every integer NOT NULL DEFAULT 4;