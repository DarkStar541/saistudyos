-- One private counter row per user; the active minute bucket is overwritten,
-- so rate limiting does not accumulate an unbounded history table.
create table if not exists public.ai_quick_add_rate_limits (
  user_id uuid primary key,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0)
);

alter table public.ai_quick_add_rate_limits enable row level security;
revoke all on public.ai_quick_add_rate_limits from anon, authenticated;

create or replace function public.consume_ai_quick_add_quota(
  p_user_id uuid,
  p_window_start timestamptz,
  p_limit integer default 10
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if p_limit < 1 or p_limit > 100 then
    raise exception 'Invalid quota limit';
  end if;

  insert into public.ai_quick_add_rate_limits (user_id, window_start, request_count)
  values (p_user_id, p_window_start, 1)
  on conflict (user_id)
  do update set
    window_start = excluded.window_start,
    request_count = case
      when public.ai_quick_add_rate_limits.window_start = excluded.window_start
        then public.ai_quick_add_rate_limits.request_count + 1
      else 1
    end
  where public.ai_quick_add_rate_limits.window_start <> excluded.window_start
     or public.ai_quick_add_rate_limits.request_count < p_limit
  returning request_count into updated_count;

  return updated_count is not null;
end;
$$;

revoke all on function public.consume_ai_quick_add_quota(uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_quick_add_quota(uuid, timestamptz, integer) to service_role;
