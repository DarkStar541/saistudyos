# Pace Stage 3 — AI Quick Add & Capture Inbox

**Status:** Architecture prepared; implementation not started.  
**Working branch:** `design/neutral-apple-inspired`

## Product outcome

A student can type a short capture such as "physics lab due Friday, work on it Thursday" and receive a proposed task with a title, course, assignment type, deadline, planned work date and priority. The student reviews the proposal and confirms before Pace writes anything.

The capture flow must be faster than opening the full TaskDialog, but must not trade away correctness or privacy.

## User flow

1. Student enters free-form text in a compact capture surface.
2. Pace sends the text, the profile timezone and a minimal list of the student's active courses (names, codes and aliases) to a server-side parser.
3. The parser returns a strictly structured proposal. It does not write to the database.
4. Pace validates the response and resolves the proposed course against courses owned by the authenticated user.
5. If a required field is ambiguous (especially course, date, or whether a date is a deadline versus a work date), show one concise clarification or mark the field for review.
6. Student confirms or edits the proposal.
7. Only after confirmation does Pace create the task using the existing task mutation/data model.
8. The captured item is removed from the pending inbox only after the task insert succeeds.

## Trust and security boundaries

- Treat all user text and model output as untrusted input.
- Keep the model-provider API key in server-side environment configuration only. Never expose it through `VITE_*`, browser bundles, local storage or client-readable cookies.
- Require a valid authenticated user session on every parse request; derive the user ID from the verified session, never from request JSON.
- Fetch the course list server-side scoped to that authenticated user. Do not trust client-supplied course IDs.
- The model may suggest a course name/code/alias; server code maps it to one of the authenticated user's owned course IDs. If there is no confident match, return an unresolved course and ask the student.
- Validate every returned field with a strict schema, length limits, enum allowlists and date parsing. Reject unknown keys and malformed output.
- The parse endpoint must not create, update, delete or complete tasks. Database writes happen only after an explicit user confirmation through the existing authenticated task path.
- Add per-user rate limiting, request-size limits, timeouts, bounded retries and safe provider-error messages before beta rollout.
- Avoid logging raw capture text or provider responses by default. Use request IDs and non-sensitive operational metrics.
- Never send task history, descriptions, notes or unrelated personal data to the model unless a later feature has a clearly justified, consented need.

## Proposed parse contract

Request (conceptual):
- `text`: required, trimmed, bounded free-form capture
- `timeZone`: profile timezone, validated as an IANA timezone
- No user ID and no authoritative course IDs supplied by the client

Response (conceptual):
- `proposal.title`: required string, bounded
- `proposal.description`: optional string, bounded
- `proposal.courseMatch`: optional suggested name/code/alias plus match status; never a trusted database ID
- `proposal.taskType`: allowlisted Pace task type
- `proposal.priority`: allowlisted Pace priority
- `proposal.dueDate`: optional calendar date / deadline instant, explicitly distinguished
- `proposal.plannedDate`: optional calendar date for intended work
- `proposal.estimatedMinutes`: optional bounded integer
- `needsClarification`: boolean
- `clarificationQuestion`: optional short question
- `confidence`: coarse server-calculated confidence band, not a promise of correctness

Use date-only values for planned work dates. Convert an explicitly timed deadline using the user's saved timezone. Do not silently interpret "Friday" as both a deadline and a planned work date.

## Architecture decisions to validate before implementation

- Prefer a server-side endpoint (Supabase Edge Function or authenticated TanStack Start server handler) after checking the actual Lovable deployment/runtime support. Do not add a client-side Gemini call.
- Use the existing Supabase authenticated identity and RLS. Avoid a service-role key for ordinary user task creation.
- Keep provider integration behind a small adapter so Gemini or another provider can be changed without coupling the UI or task model to it.
- Reuse existing task types, priorities, timezone helpers and task creation validation; do not create a parallel task schema.
- Keep the capture inbox user-private. Define whether it is local draft state or server-persisted pending records before implementation; do not create a second task source of truth.
- Start with one-item capture and explicit confirmation. Batch capture, voice capture, Canvas context and automatic task creation are later enhancements.

## Implementation sequence

1. Confirm deployment-supported server execution and secret configuration.
2. Add a strict shared schema and pure parser-response validation tests.
3. Add authenticated server endpoint with user-scoped course lookup, rate limits and provider timeout/error handling.
4. Add server tests for malformed output, unknown course, cross-user course IDs, ambiguous dates, prompt injection text and provider failure.
5. Add the compact capture UI and proposal review/clarification state.
6. Reuse existing task insert path after confirmation; add tests for success, duplicate submission and failure recovery.
7. Add synthetic two-user isolation tests and verify the endpoint cannot read another user's courses.
8. Only then consider Canvas and Google Calendar integration work.

## Explicit non-goals for the first release

- No autonomous task creation without confirmation.
- No broad access to Canvas or Google accounts.
- No AI access to all tasks, notes or files.
- No service-role key in the browser.
- No vendor-specific provider code in UI components.
- No assumption that all schools expose the same Canvas API permissions.


## Implementation checkpoint — first AI Quick Add vertical slice

Implemented on `design/neutral-apple-inspired`:

- Added `supabase/functions/ai-quick-add/index.ts`, an authenticated Supabase Edge Function using Gemini 2.5 Flash.
- The function verifies the bearer session, fetches active courses and profile settings with the user's JWT (therefore subject to RLS), and sends only the capture text plus minimal course context to Gemini.
- Model output is validated server-side; task type, priority, dates, times and text lengths are bounded. Course names are resolved server-side against the authenticated user's own active courses. The model never receives or returns authoritative course IDs.
- The endpoint only returns a proposal. It does not write tasks.
- Added a database-backed atomic limit of 10 parse requests per user per minute. The counter uses one row per user, not an unbounded request log.
- Added a Dashboard AI widget review flow. The student can edit title, course, type, priority, deadline, work date, estimate and description, then explicitly confirm before the normal RLS-protected task insert.
- Added a strict client-side Zod schema and unit tests for malformed IDs, dates, times, enums, oversized content, unknown fields and invalid durations.

### Required deployment setup before the feature can run

1. Apply `drizzle/migrations/0004_ai_quick_add_rate_limits.sql` to the connected Supabase database. Registering the migration in Git does not apply it to the live database.
2. Deploy the `ai-quick-add` Supabase Edge Function with `supabase/config.toml` so JWT verification is enabled.
3. Add `GEMINI_API_KEY` as a server-side Supabase/Lovable secret. Never add it to a `VITE_*` variable or browser code.
4. Confirm the Edge Function runtime has its standard `SUPABASE_URL`, `SUPABASE_ANON_KEY` (or publishable-key equivalent), and `SUPABASE_SERVICE_ROLE_KEY` secrets.
5. Test with two synthetic accounts: each account must receive only its own course matches; unknown course names must remain unresolved; the endpoint must reject unauthenticated requests and enforce the per-user rate limit.
6. Test the complete proposal/edit/confirm flow in the published app.

The feature is implemented in source but is **not considered live or release-ready** until the migration, function deployment, secret configuration and browser/security tests are completed. No Gemini key or other secret is stored in the repository.
