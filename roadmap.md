# Pace — Master Development Roadmap

**Current working branch:** `design/neutral-apple-inspired`  
**Base branch:** `feature/stage-2`  
**Production/main:** unchanged. Do not merge without explicit approval.

Status key:
- ~~[x]~~ Implemented/finished (crossed out)
- [ ] Not yet completed
- [~] Implemented but still needs verification or final polish

## 1. Stage 2 — Existing bug resolution

### Recurrence and date reliability
- ~~[x]~~ Fix monthly recurrence clamping (e.g. a 31st does not incorrectly rewind the month)
- ~~[x]~~ Expand missed-occurrence catch-up guard
- ~~[x]~~ Add timezone-aware date keys and date/time input conversion helpers
- ~~[x]~~ Use the saved profile timezone for task and project date inputs/saving
- ~~[x]~~ Apply profile timezone to calendar grouping, dashboard week strip, today/upcoming calculations and recurrence generation
- ~~[x]~~ Add future recurring-work projection without inserting fake database rows
- ~~[x]~~ Suppress projected dates already represented by actual task rows
- ~~[x]~~ Add a duplicate guard when skipping a recurring occurrence
- ~~[x]~~ Improve whole-series editing while preserving per-occurrence planned dates and completed history
- [~] Resolve the remaining dual-date discrepancy: planned/work dates and due/deadline dates remain separate; saved-timezone labels cover task lists, boards, task rows, projects, dashboard and Calendar; carried-forward completions count in Today progress; recurring deadlines are de-duplicated in dashboard counts and lists. Synthetic recurrence/timezone/DST regression tests pass; browser and real-data scenario checks remain pending.
- [~] Verify real user scenarios: automated synthetic coverage includes MathXL-style weekday schedules, month boundaries, weekends, timezone/DST conversion, recurrence ends and catch-up. Still verify actual MathXL/Catapult Design records and end-to-end edits, skips, completion and deletion in the app.
- [ ] Consider database-level protection against concurrent duplicate recurrence generation

### Calendar, Projects and controls
- ~~[x]~~ Add a separate long-range Calendar page with month navigation and completed-task visibility
- ~~[x]~~ Add Calendar to desktop and mobile navigation
- ~~[x]~~ Improve Project milestone input width and responsive layout
- ~~[x]~~ Replace targeted native dropdown/date controls in Tasks, Courses, Settings, Projects and Dashboard Quick Capture
- ~~[x]~~ Align overdue widget heading with the other neutral widget headings
- ~~[x]~~ Correct Dashboard lower-metric alignment
- [~] Add recurring-series deadline de-duplication to dashboard counts/lists and regression tests; unit coverage passes. Verify calendar event counts, due counts and projections against real user data in the browser.
- ~~[x]~~ Replace native checkboxes in Tasks and Courses with shared controls; the remaining native time inputs are intentional platform-native time pickers. No native date/dropdown controls remain in the audited core routes.

## 2. Section 2.1 — Complete visual transformation

### Design direction
- ~~[x]~~ Set the product name to **Pace**
- ~~[x]~~ Establish the neutral, restrained, broadly appealing design direction
- ~~[x]~~ Replace old runtime theme selection with one consistent neutral visual style
- ~~[x]~~ Keep light, dark and system appearance options
- [~] Apply one neutral system for typography, spacing, hierarchy, surfaces, borders, shadows, color and interaction states. Neutral runtime styling and system-font stack are in place; route-by-route visual review and browser verification remain.
- [ ] Keep the interface calm and practical; avoid excessive gradients, glass effects, decorative gauges and unnecessary animation

### App shell and core pages
- ~~[x]~~ Refresh the app shell, wordmark and navigation styling
- ~~[x]~~ Add shared page-header styling and responsive layout foundations
- ~~[x]~~ Refresh Courses index/detail hierarchy
- [~] Dashboard: neutral surface, header, cards and spacing foundations are in place; Pace metadata and timezone behavior corrected; finish the full page review
- [~] Tasks: neutral page foundation and shared controls in place; finish the full page visual review
- [~] Projects: neutral page foundation and saved-timezone deadline labels in place; finish the full page visual review
- [~] Calendar: page, timezone-aware month/today behavior and neutral styling foundations are in place; finish full-page review
- [~] Settings: neutral card and appearance foundations are in place; finish the full page visual review
- ~~[x]~~ Create the Pace public landing page with product explanation, feature overview, preview and calls to action
- [~] Refine auth and password-reset screens for consistent Pace branding, accessible labels and browser autofill. Browser verification remains; no separate onboarding flow exists yet.

### Responsive and accessibility polish
- ~~[x]~~ Make the sidebar/navigation scrollable
- [~] Adjust responsive breakpoints and layout behavior for high zoom (including 175%); browser verification still required
- [ ] Verify desktop, tablet, mobile and 175% browser zoom on every major route
- [ ] Verify light/dark/system modes on every major route
- [ ] Check keyboard navigation, focus visibility, reduced-motion behavior, contrast and accessible labels

## 3. Section 2.2 — Performance and reliability

### Implemented optimization pass
- ~~[x]~~ Mount TaskDialog only when opened on the main routes
- ~~[x]~~ Memoize Dashboard analytics calculations
- ~~[x]~~ Replace repeated per-project task filtering with one-pass aggregation
- ~~[x]~~ Replace repeated per-course task counting with one-pass aggregation
- ~~[x]~~ Add local-session fast path so cached sessions do not wait for the Lovable preview editor bridge
- ~~[x]~~ Use local `getSession()` rather than network-backed `getUser()` for the auth-page redirect check
- ~~[x]~~ Preserve Supabase persistent sessions and automatic token refresh; do not store auth tokens in JavaScript-readable cookies

### Remaining performance work
- [~] Code-level performance audit completed and documented in `docs/stage-2-performance-multiuser-audit.md`; focus-session history fetch is bounded to 120 days and composite per-user query indexes are defined in migration 0003. Published-app cold/warm load, auth restoration, dashboard, dialog, task toggle and calendar timings remain unmeasured.
- [~] Split today-only focus-session fetching from the 120-day Insights query; Dashboard and Focus now request only the current profile-timezone day.
- [~] Lazy-load Recharts charts so the charting library is fetched only when Insights is opened.
- [~] Lazy-load TaskDialog and its form dependencies so the editor bundle is fetched only when the user opens task creation/editing.
- [x] Remove the redundant Focus-session refetch after save; the mutation already invalidates the focus-session query family.
- [~] Enable TanStack automatic route-level code splitting through the existing Lovable TanStack Start configuration. Unit tests, lint and production build pass with the setting; emitted chunk inspection and first-visit/navigation behavior still need verification.
- [ ] Compare before/after timings on the same deployment and device; runtime gains still need measurement.
- [~] Repository query-path audit completed; focus history no longer downloads unbounded lifetime records. Full slow-query plans, render profiling and route-bundle profiling require deployed database/browser measurements.
- [ ] Investigate intermittent login failures if they persist after the auth fast-path change
- [ ] Verify session restoration in embedded Lovable preview and the published domain separately
- [~] Add reusable loading, error and retry states to Dashboard, Tasks, Calendar, Projects, Settings, Courses and Course detail. Static build passes; verify session-expiry behavior and retry flows in the browser.

## 4. Focus and productivity features
- [~] Create authenticated Focus and Insights routes/pages; implementations and regression coverage are committed; browser verification remains
- [~] Add Focus Mode page, navigation entry and task selection for session context
- [~] Add a Focus button directly on task rows and in the task editor; verify both navigation handoffs in browser
- [~] Implement timestamp-based focus countdown with pause/resume, early finish, discard and local timer restoration; preserve selected focus/short-break/long-break kind and associate tasks only with focus sessions. Unit coverage includes elapsed/remaining time, pause accounting and session metadata; browser refresh, tab suspension and session persistence still need verification
- [~] Add short/long break modes and editable focus/break duration settings in Settings; browser verification remains
- [~] Add Insights page with focus and completed-task charts, 7/30/90-day period selector and 12-week activity heatmap; fix planned-work aggregation and aggregate focus sessions once per timezone date instead of rescanning all sessions for each heatmap day
- [~] Group Insights data using profile timezone and separate planned-work dates from completion timestamps; validate DST and date-boundary behavior

## 5. Security, privacy and multi-user readiness
- [~] Add database relationship guards so projects, milestones, tasks and focus sessions cannot reference another user's course/project/task; migration `0002_multi_user_relationship_hardening.sql` is committed but must still be applied to the connected database
- [x] Clear the client query cache on sign-in/sign-out account boundaries to prevent stale workspace data appearing after an account switch
- [x] Redirect returning users with a persisted session from the public root URL directly to their Dashboard; signed-out visitors still see the landing page
- [x] Clarify during signup that each account gets its own private workspace
- [~] Review existing RLS: profiles are scoped by auth.uid() = id; courses, projects, milestones, tasks, subtasks and focus_sessions are scoped by auth.uid() = user_id. Separate-account browser verification remains open
- [~] Supabase browser client uses the publishable key, not a service-role key; complete repository/deployment secret audit remains open
- [ ] Validate AI Quick Add output server-side and map inferred courses only to courses owned by the signed-in user (Stage 3 architecture documented in docs/stage-3-ai-quick-add-architecture.md)
- [ ] Add rate limits and safe failure handling to AI endpoints
- [ ] Require confirmation when AI Quick Add is uncertain before creating or changing data
- [ ] Review OAuth redirects, session refresh, logout and password-reset flows
- [~] Signup creates a separate private workspace and explains account-level privacy; beta remains open-signup for the shared-friend test. Verify with two separate synthetic accounts

## 6. AI Quick Add and integrations
- [ ] Build natural-language task capture using the user's saved course list
- [ ] Infer course, due date, assignment type and priority from short input
- [ ] Ask for clarification when the inference is ambiguous
- [ ] Keep capture fast and low-friction for situations where the student cannot open a laptop or phone
- [ ] Evaluate integrations based on real student value; Canvas is the relevant LMS context (not Google Classroom)
- [ ] Keep the architecture portable and avoid unnecessary vendor lock-in

## 7. Mobile app experience (PWA)
- [~] Add a web app manifest, Pace app icon, standalone display metadata and mobile web-app tags
- [x] Add iPhone/iPad and Android home-screen installation instructions in Settings
- [x] Respect mobile safe-area insets for the bottom navigation and floating New Task button
- [ ] Verify installation and launch on real iPhone/iPad and Android devices; confirm auth/session behavior in standalone mode
- [~] Add a native install prompt when the browser exposes `beforeinstallprompt`; detect standalone installation and show an installed state. Keep the iOS Safari manual install guide because iOS does not expose the same prompt API. Verify on real Android and iOS devices
- [ ] Add carefully scoped offline support for static app assets only; never cache private API responses or user workspace data without an explicit offline-sync design
- [ ] Evaluate native packaging only if PWA limitations block a concrete requirement (e.g. app-store distribution or platform-specific integrations)

## 8. Release readiness
- ~~[x]~~ Run the full test suite, including recurrence, timezone and daylight-saving tests (GitHub Actions passed).
- ~~[x]~~ Run static lint and production build (GitHub Actions passed).
- [ ] Run browser tests for auth, navigation, CRUD, recurrence, calendar, focus and responsive layouts
- [ ] Verify data isolation with at least two separate accounts in the published app after the relationship-hardening migration is applied
- [ ] Verify no regressions in light/dark/system appearance
- [ ] Review loading, empty, error and offline states
- [ ] Update README, deployment URL and product metadata where needed
- [ ] Review the complete draft PR and CI results
- [ ] Merge to `main` only after explicit approval


## 9. User-facing "Coming next" roadmap (Settings)

Keep the Settings page's **Coming next** section aligned with this roadmap. These are planned product milestones, not features that should be presented as already shipped.

- [ ] **AI Quick Add & Capture Inbox** — Planned. Build fast natural-language task capture and an inbox for reviewing/confirming captured items. Use the saved course list to infer course, due date, assignment type and priority; ask for clarification when uncertain.
- [ ] **Canvas LMS** — Stage 3. Explore a secure Canvas integration for useful course and assignment context. Keep permissions scoped, protect account data and avoid assuming every school enables the same Canvas capabilities.
- [ ] **Google Calendar** — Stage 3. Explore calendar connection and event/task visibility, with clear user consent, conflict handling and control over what Pace reads or writes.
- [ ] **AI Hub & Knowledge Library** — Stage 4. Plan a centralized AI workspace and knowledge library that can organize useful school context and support future AI workflows without compromising privacy or making the app unnecessarily complex.


---

## Current checkpoint

Stage 2 implementation is substantially complete, but **Stage 2 is not closed**: remaining gates are browser/real-data verification, applying and verifying migration `0002_multi_user_relationship_hardening.sql` in the connected Supabase database, two-account isolation checks, responsive/theme/accessibility review and published-app performance measurements. Do not mark those items complete from CI alone.

Recent code work on `design/neutral-apple-inspired`: responsive app-shell breakpoint switches to bottom navigation below a 1100px CSS viewport; Focus timer preserves focus/short-break/long-break kind and associates tasks only with focus sessions; Insights now computes planned-work totals and aggregates focus minutes once by profile-timezone date; regression tests cover Focus metadata and timezone-aware Insights aggregation.

Stage 3 preparation: secure AI Quick Add & Capture Inbox architecture is documented in `docs/stage-3-ai-quick-add-architecture.md`. Before implementation, confirm supported server-side execution and secret configuration. The model must propose structured task data only; it must not write tasks. Require user confirmation before task creation. Canvas LMS and Google Calendar remain later Stage 3 integration investigations; AI Hub & Knowledge Library remains Stage 4.

The `main` branch remains untouched. Do not merge without explicit approval.
