# Pace Roadmap

## Dual-date diagnosis and fix
- [ ] Diagnose calendar banners, deadline indicators, daily counts and actual recurring settings
- [ ] Fix shared date representation and recurring date calculation without changing existing data
- [ ] Test MathXL, Catapult Design and edge cases; verify signed-in calendar/dashboard

## Day 1 — Global performance (done)
- [x] Baseline measurements via Playwright (nav, cold load, dialog, toggle)
- [x] Route guard + profile query: local session read instead of auth-server round trip
- [x] QueryClient defaults: no refetch-on-focus, retry 1, 30s staleTime
- [x] Route preloading on hover/intent
- [x] Optimistic updates with rollback: task toggle, delete, row edits
- [x] Course detail: drop refetch after last-accessed tracking
- [x] After-measurements + report

## Visual Transformation Phase 1 — design foundation + dashboard (in progress)
- [ ] Design tokens: editorial palette (warm paper light / ink-plum dark), serif display type, refined shadows
- [ ] App shell: sidebar, mobile nav, page wash
- [ ] Dashboard: editorial masthead with stats, widget chrome, week strip, workload chart
- [ ] Verify: light/dark, desktop/mobile, tests, build

## Stage 2 — remaining (paused)
- [ ] Focus mode page + nav entry, focus button on tasks, focus settings in Settings
- [ ] Insights page: productivity, workload, focus charts + heatmap, period selector
- [ ] Remaining native dropdowns in Settings/Tasks/Courses → styled components
- [ ] Dark mode + responsive verification
- [ ] Recurrence engine tests (src/lib/recurrence.ts)
