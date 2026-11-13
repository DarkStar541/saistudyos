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
- [ ] Measure cold load, warm navigation, auth restoration, dashboard load, dialog open, task toggle and calendar navigation in the published app/preview; no browser timing harness is available through the current GitHub-only workflow.
- [ ] Compare before/after timings on the same deployment and device; removing unused Google Fonts requests reduces external font work, but runtime gains still need measurement.
- [ ] Profile slow queries, unnecessary renders and large route bundles; optimize only where measurements show a bottleneck
- [ ] Investigate intermittent login failures if they persist after the auth fast-path change
- [ ] Verify session restoration in embedded Lovable preview and the published domain separately
- [~] Add reusable loading, error and retry states to Dashboard, Tasks, Calendar, Projects, Settings, Courses and Course detail. Static build passes; verify session-expiry behavior and retry flows in the browser.

## 4. Focus and productivity features
- [~] Create authenticated Focus and Insights routes/pages; initial implementations are committed, pending CI and browser verification
- [~] Add Focus Mode page, navigation entry and task selection for session context
- [~] Add a Focus button directly on task rows and in the task editor; verify both navigation handoffs in browser
- [~] Implement timestamp-based focus countdown with pause/resume, early finish, discard and local timer restoration; add unit coverage for elapsed/remaining time and pause accounting; browser refresh, tab suspension and session persistence still need verification
- [~] Add short/long break modes and editable focus/break duration settings in Settings; browser verification remains
- [~] Add Insights page with focus and completed-task charts, 7/30/90-day period selector and 12-week activity heatmap
- [~] Group Insights data using profile timezone and separate planned-work dates from completion timestamps; validate DST and date-boundary behavior

## 5. Security, privacy and multi-user readiness
- [~] Add database relationship guards so projects, milestones, tasks and focus sessions cannot reference another user's course/project/task; migration `0002_multi_user_relationship_hardening.sql` is committed but must still be applied to the connected database
- [x] Clear the client query cache on sign-in/sign-out account boundaries to prevent stale workspace data appearing after an account switch
- [x] Redirect returning users with a persisted session from the public root URL directly to their Dashboard; signed-out visitors still see the landing page
- [x] Clarify during signup that each account gets its own private workspace
- [~] Review existing RLS: profiles are scoped by auth.uid() = id; courses, projects, milestones, tasks, subtasks and focus_sessions are scoped by auth.uid() = user_id. Separate-account browser verification remains open
- [~] Supabase browser client uses the publishable key, not a service-role key; complete repository/deployment secret audit remains open
- [ ] Validate AI Quick Add output server-side and map inferred courses only to courses owned by the signed-in user
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
- [ ] Add a native install prompt for supported Android browsers and a clear iOS install guide/onboarding affordance
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

---

## Current checkpoint

The Stage 2 implementation pass, Pace rename, neutral design foundation, Calendar page, landing page, date/time consistency fixes, recurring-deadline de-duplication, shared loading/error states, first auth/performance optimizations and initial multi-user hardening are committed to `design/neutral-apple-inspired`. The next roadmap stage now has initial Focus and Insights pages, authenticated routes and navigation, configurable focus/break durations, timestamp-based pause/resume timing, local timer restoration, analytics charts/heatmap and an initial installable-PWA foundation. New work has not yet passed CI or browser verification; direct task-to-focus navigation, timer/session persistence tests and analytics edge cases remain open. The `main` branch remains untouched.
