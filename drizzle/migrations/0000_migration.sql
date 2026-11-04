
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  school text,
  timezone text not null default 'UTC',
  theme text not null default 'system',
  default_task_view text not null default 'list',
  default_priority text not null default 'medium',
  default_duration_minutes int not null default 60,
  week_starts_on int not null default 1,
  dashboard_widgets jsonb not null default '["today","overdue","upcoming","exams","calendar","workload","courses","quickadd","ai"]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null check (char_length(name) between 1 and 120),
  code text,
  teacher text,
  color text not null default 'purple',
  icon text not null default 'book',
  semester text,
  aliases text[] not null default '{}',
  schedule jsonb not null default '[]'::jsonb,
  notes text,
  archived boolean not null default false,
  last_accessed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.courses(user_id);
create trigger courses_touch before update on public.courses for each row execute function public.touch_updated_at();

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  course_id uuid references public.courses(id) on delete set null,
  name text not null check (char_length(name) between 1 and 160),
  description text,
  due_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.projects(user_id);
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  due_at timestamptz,
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.milestones(project_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  course_id uuid references public.courses(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  milestone_id uuid references public.milestones(id) on delete set null,
  title text not null check (char_length(title) between 1 and 300),
  description text,
  task_type text not null default 'assignment',
  status text not null default 'todo',
  priority text not null default 'medium',
  due_at timestamptz,
  planned_date date,
  estimated_minutes int,
  tags text[] not null default '{}',
  recurrence text not null default 'none',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.tasks(user_id);
create index on public.tasks(user_id, due_at);
create index on public.tasks(user_id, planned_date);
create trigger tasks_touch before update on public.tasks for each row execute function public.touch_updated_at();

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.subtasks(task_id);

do $$ declare t text; begin
  foreach t in array array['courses','projects','milestones','tasks','subtasks'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own select" on public.%I for select to authenticated using (auth.uid() = user_id)', t);
    execute format('create policy "own insert" on public.%I for insert to authenticated with check (auth.uid() = user_id)', t);
    execute format('create policy "own update" on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "own delete" on public.%I for delete to authenticated using (auth.uid() = user_id)', t);
  end loop;
end $$;
