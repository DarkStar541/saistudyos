<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Data access goes through `src/lib/db.ts` (react-query + browser client); every user table has RLS scoped to `auth.uid() = user_id`, which is the security boundary.
- Task date rules (due vs planned work date, overdue, workload) live as pure functions in `src/lib/task-utils.ts` with tests in `src/test/` — keep logic there so it stays testable.
- Calendar surfaces use the shared calendar-day index and CalendarTask control; recurrence shifts dual dates together in the pure recurrence engine to preserve scheduling offsets without rewriting stored tasks.
- Signed-in pages live under `src/routes/_authenticated/` and render inside `AppShell`.
