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
- [ ] Resolve the remaining dual-date discrepancy: distinguish planned/work dates from due/deadline dates consistently across calendar banners, deadline indicators, daily counts and recurrence settings
- [ ] Verify real user scenarios (including MathXL and Catapult Design), month boundaries, weekends, timezone changes, series edits, skips, completion and deletion
- [ ] Consider database-level protection against concurrent duplicate recurrence generation

### Calendar, Projects and controls
- ~~[x]~~ Add a separate long-range Calendar page with month navigation and completed-task visibility
- ~~[x]~~ Add Calendar to desktop and mobile navigation
- ~~[x]~~ Improve Project milestone input width and responsive layout
- ~~[x]~~ Replace targeted native dropdown/date controls in Tasks, Courses, Settings, Projects and Dashboard Quick Capture
- ~~[x]~~ Align overdue widget heading with the other neutral widget headings
- ~~[x]~~ Correct Dashboard lower-metric alignment
- [ ] Verify calendar event counts, due counts and recurring projections against real data
- [ ] Finish auditing any remaining native controls outside the files already checked

## 2. Section 2.1 — Complete visual transformation

### Design direction
- ~~[x]~~ Set the product name to **Pace**
- ~~[x]~~ Establish the neutral, restrained, broadly appealing design direction
- ~~[x]~~ Replace old runtime theme selection with one consistent neutral visual style
- ~~[x]~~ Keep light, dark and system appearance options
- [ ] Finish one coherent design system across every screen: typography, spacing, hierarchy, surfaces, borders, shadows, color and interaction states
- [ ] Keep the interface calm and practical; avoid excessive gradients, glass effects, decorative gauges and unnecessary animation

### App shell and core pages
- ~~[x]~~ Refresh the app shell, wordmark and navigation styling
- ~~[x]~~ Add shared page-header styling and responsive layout foundations
- ~~[x]~~ Refresh Courses index/detail hierarchy
- [~] Dashboard: neutral surface, header, cards and spacing foundations are in place; finish the full page review
- [ ] Tasks: complete visual refinement
- [ ] Projects: complete visual refinement
- [~] Calendar: page and neutral styling foundations are in place; finish full-page review
- [ ] Settings: complete visual refinement
- [ ] Focus: complete visual refinement
- [ ] Insights: complete visual refinement
- ~~[x]~~ Create the Pace public landing page with product explanation, feature overview, preview and calls to action
- [ ] Review and refine auth, password-reset and onboarding screens for a consistent Pace experience

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
- [ ] Measure cold load, warm navigation, auth restoration, dashboard load, dialog open, task toggle and calendar navigation
- [ ] Compare before/after timings on the same deployment and device
- [ ] Profile slow queries, unnecessary renders and large route bundles; optimize only where measurements show a bottleneck
- [ ] Investigate intermittent login failures if they persist after the auth fast-path change
- [ ] Verify session restoration in embedded Lovable preview and the published domain separately
- [ ] Add graceful loading/error states for network and session failures

## 4. Focus and productivity features
- [ ] Complete Focus Mode page and navigation entry
- [ ] Add task-to-focus entry point
- [ ] Finish focus duration, break and related settings
- [ ] Verify timer correctness using timestamps (not interval-only elapsed-time tracking), including refresh, tab suspension and resume
- [ ] Complete Insights page with productivity, workload and focus summaries
- [ ] Add useful charts, heatmap and period selector
- [ ] Ensure analytics use correct timezone and date semantics

## 5. Security, privacy and multi-user readiness
- [ ] Audit Row Level Security policies and confirm strict per-user data isolation
- [ ] Confirm no service-role secrets are exposed to the browser
- [ ] Validate AI Quick Add output server-side and map inferred courses only to courses owned by the signed-in user
- [ ] Add rate limits and safe failure handling to AI endpoints
- [ ] Require confirmation when AI Quick Add is uncertain before creating or changing data
- [ ] Review OAuth redirects, session refresh, logout and password-reset flows
- [ ] Keep beta invite-gated; test with synthetic data and separate test accounts

## 6. AI Quick Add and integrations
- [ ] Build natural-language task capture using the user's saved course list
- [ ] Infer course, due date, assignment type and priority from short input
- [ ] Ask for clarification when the inference is ambiguous
- [ ] Keep capture fast and low-friction for situations where the student cannot open a laptop or phone
- [ ] Evaluate integrations based on real student value; Canvas is the relevant LMS context (not Google Classroom)
- [ ] Keep the architecture portable and avoid unnecessary vendor lock-in

## 7. Release readiness
- [ ] Run the full test suite, including recurrence and timezone tests
- [ ] Run lint and production build
- [ ] Run browser tests for auth, navigation, CRUD, recurrence, calendar, focus and responsive layouts
- [ ] Verify data isolation with at least two synthetic user accounts
- [ ] Verify no regressions in light/dark/system appearance
- [ ] Review loading, empty, error and offline states
- [ ] Update README, deployment URL and product metadata where needed
- [ ] Review the complete draft PR and CI results
- [ ] Merge to `main` only after explicit approval

---

## Current checkpoint

The Stage 2 implementation pass, Pace rename, neutral design foundation, Calendar page, landing page, and first performance/auth optimizations have been committed to `design/neutral-apple-inspired`. Several items are **implemented but not yet browser/build/test verified**. The next priority is to resolve the remaining planned-date-versus-due-date discrepancy, then finish the screen-by-screen visual pass and measure performance. The `main` branch remains untouched.
