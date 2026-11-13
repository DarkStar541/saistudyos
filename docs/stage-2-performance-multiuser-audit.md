# Stage 2 — Performance and multi-user readiness audit

**Audit date:** 2026-11-13  
**Branch:** `design/neutral-apple-inspired`  
**Scope:** Repository and CI inspection only. No live Supabase SQL execution, browser profiling, or two-account browser session was available during this audit.

## Performance findings

### Confirmed in code
- React Query uses a 60-second stale time for workspace queries, avoiding refetches on every route navigation.
- Dashboard aggregate calculations are memoized; project/course aggregation has prior one-pass optimizations.
- TaskDialog is lazy-mounted on the main routes.
- Auth restoration uses the local persisted session path for the profile query and auth redirect; persistent sessions and automatic refresh remain enabled.
- Focus timer uses timestamps for elapsed/remaining time rather than trusting interval tick counts.
- Insights focus sessions are aggregated once by profile-timezone date and reused for the chart and heatmap.
- Focus history fetching is now bounded to the latest 120 days. This covers the 90-day Insights selector and 12-week heatmap with a timezone buffer, instead of downloading an unbounded lifetime history.
- New composite indexes are defined in `0003_user_query_indexes.sql` for per-user project/course, milestone/project, subtask/task, recurring-task lookup, task status and focus-session kind/date access.

### Remaining performance risks / unmeasured
- Tasks and other workspace collections are fetched as full per-user result sets; there is no pagination or server-side aggregation yet. This is acceptable for a small beta but must be measured with realistic larger datasets before public scale.
- No cold/warm load, route-navigation, auth-restoration, dialog-open, task-toggle or calendar-navigation timings were captured.
- No browser profiler, React render profiler, Lighthouse trace or production bundle comparison was run in this environment.
- The new indexes are migration code only until applied to the connected database. Their actual query-plan benefit is unverified.
- No slow-query / EXPLAIN ANALYZE data is available.

## Multi-user isolation findings

### Confirmed in code
- `0000_migration.sql` enables RLS on profiles, courses, projects, milestones, tasks and subtasks.
- Row policies restrict reads, inserts, updates and deletes to `auth.uid() = user_id`; profile policies use `auth.uid() = id`.
- `0001_recurrence_and_focus_sessions.sql` enables RLS on focus_sessions and scopes all operations to the row owner.
- The Supabase browser client uses the publishable key, not a service-role key. No service-role key reference was found in the targeted repository code search.
- The app clears the React Query cache on SIGNED_IN and SIGNED_OUT and invalidates it on USER_UPDATED.
- `0002_multi_user_relationship_hardening.sql` adds triggers to reject cross-user references for project→course, milestone→project, task→course/project/milestone and focus-session→task/course relationships.
- The relationship trigger is ordinary invoker-context PL/pgSQL, not SECURITY DEFINER. Authenticated callers therefore do not gain a privileged cross-user lookup path from the trigger.

### Gaps / operational checks
- Migration `0002` was previously reported as not yet applied to the connected Supabase project. This audit cannot inspect the live migration history, so assume it is **not applied** until verified in Supabase.
- Migration `0003` adds query indexes and is also pending application.
- No automated test currently provisions two auth users and proves that User A cannot select, update, delete, or attach User B's rows.
- No live test proves that the triggers reject foreign course/project/milestone/task IDs under authenticated sessions.
- Confirm that production and preview use the intended Supabase project and that no service-role secret is exposed to browser build variables.

## Required live verification before Stage 2 can close

Use two synthetic test accounts, A and B, with separate courses, projects, milestones, tasks and focus sessions.

1. Sign in as A; verify A sees only A's records.
2. Sign in as B in a separate browser profile; verify B sees only B's records.
3. Attempt cross-user reads and writes through the app/API using B's IDs while authenticated as A; expect zero visible rows or RLS rejection.
4. Attempt to create A-owned task/project/focus rows referencing B-owned related rows; expect trigger rejection after migration 0002 is confirmed applied.
5. Sign out A and sign in B in the same browser profile; confirm no A data flashes from React Query cache.
6. Verify inserts, updates and deletes remain isolated after refresh and session renewal.
7. In Supabase migration history, verify 0002 and 0003 are applied to the correct project. Do not blindly rerun SQL.
8. Capture query plans for task list, recurring occurrence lookup, focus-session history, milestone and subtask queries before/after 0003.

## Performance measurement protocol

Record the same measurements on the same machine, browser, zoom and deployed build:
- Cold first load (hard reload, cache disabled)
- Warm dashboard navigation
- Sign-in/session restoration
- Dashboard data ready
- Tasks route data ready
- Task dialog open
- Task toggle to confirmed server response
- Calendar month navigation
- Insights load with a synthetic 90-day/12-week dataset

Capture median and p95 across at least five runs where practical. Record dataset sizes and network conditions. Compare before/after; do not infer improvement from code changes alone.

## Audit conclusion

The repository has a sound baseline for per-row ownership isolation, plus additional relationship hardening in migration 0002. The browser client does not use a service-role key. However, multi-user readiness is **not certified** until migrations 0002/0003 are confirmed applied and the two-account isolation matrix passes.

Performance optimizations are present and the unbounded focus-history fetch has been capped, but actual published-app performance remains **unmeasured**. Do not close Stage 2 based on CI alone.


## Follow-up app-wide performance audit and changes (2026-11-13)

### Confirmed waste removed
- Dashboard and Focus previously consumed the same 120-day focus-session query as Insights, even though both only display today's focus total. Added a timezone-aware today-only query keyed by timezone and date; Dashboard and Focus now use that smaller result set. Insights retains the 120-day history.
- Insights previously imported Recharts directly in its route module. The charts now live in a dynamically imported component, so the charting library is loaded only when Insights is opened.
- TaskDialog was conditionally mounted but statically imported by the app shell and multiple routes. Added a lazy wrapper and replaced direct imports across the app shell, Dashboard, Tasks, Calendar, Projects and Course detail. The editor and its form dependencies are now fetched only when the dialog is opened.
- Focus session completion previously performed an explicit refetch immediately after the shared save mutation had already invalidated the focus-session query family. Removed the duplicate request.

### Additional audit findings
- The generated `src/routeTree.gen.ts` statically imports each route module. Route-level component code splitting is not currently evident in the generated tree. This is a high-value remaining optimization, but should be implemented using the supported TanStack Router code-splitting configuration and verified against the Lovable Vite wrapper before changing router generation.
- Tasks, courses, projects and milestones are still fetched as complete per-user collections. This is simple and appropriate for a small private beta; pagination, selective projections and server-side aggregation should be driven by measured dataset size and query plans rather than introduced prematurely.
- Dashboard and Focus still depend on the shared tasks query because their widgets/task selector need task records. A future summary endpoint could reduce this further, but should wait until query latency and row counts are measured.
- No browser profiler, real published-domain trace, bundle analyzer output, or deployed query plans were available. Therefore no numerical speedup is claimed.

### Verification status
- GitHub CI for earlier commits in this pass passed tests, lint and production build.
- CI for the final lazy-query, lazy-chart, lazy-dialog and duplicate-refetch commits is pending at the time of this update.
- Verify first-open TaskDialog loading, Insights chart loading, Dashboard/Focus day-boundary behavior, and actual tab-return timing in the published app.
