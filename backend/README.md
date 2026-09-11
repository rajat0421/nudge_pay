# NudgePay Backend

Invoice follow-up automation for small businesses and agencies. Users track
invoices they've already sent (via whatever they already invoice with) and
NudgePay automatically emails their client on a configurable schedule until
it's marked paid. NudgePay never processes payments or issues invoices
itself — it just chases them.

## Architecture

A modular monolith — one deployable, clearly separated modules, no
microservices/Kafka/Redis. Each domain module follows the same shape:

```
modules/<name>/
  <name>.routes.ts       Fastify route registration + OpenAPI schema
  <name>.controller.ts   HTTP handlers — parse request, call service, shape response
  <name>.service.ts       Business logic, authorization-relevant decisions
  <name>.repository.ts    All Supabase queries for this module, always org-scoped
  <name>.schemas.ts        Zod request schemas (source of truth for validation + docs)
  <name>.types.ts          Shared TS types
```

```
src/
  app.ts              Fastify app factory (plugins, routes) — used by server.ts and tests
  server.ts           API process entrypoint
  worker.ts           Standalone reminder-worker process entrypoint (optional, see below)
  config/             env validation (zod), constants, logger
  db/
    supabase.ts       The one @supabase/supabase-js client; unwrap()/error mapping
    mappers.ts         Row shapes + Date hydration for every table
  middleware/         auth guard, centralized error handler, rate limiting, request IDs
  modules/            auth, users, organizations, clients, invoices, reminders,
                      email, dashboard, audit, health
  jobs/               reminder-scheduler (status sweep), reminder-worker (send),
                      retry-worker (backoff), runner (ties them together on an interval)
  utils/              dates (timezone-safe), money (integer minor units), crypto, pagination
supabase/
  migrations/         Plain SQL — schema + RPC functions (see below)
scripts/
  migrate.ts          Applies supabase/migrations/*.sql (the only place DIRECT_URL is used)
  seed.ts             Loads demo data
  clean.ts            Wipes all data
tests/
```

The app's only database access, at runtime, is `@supabase/supabase-js`
talking to Supabase over HTTPS — there is no ORM and no direct Postgres
connection in the running process.

```
Fastify
   ↓
@supabase/supabase-js
   ↓
Supabase PostgreSQL
```

### Multi-tenancy

Every tenant-owned table (`clients`, `invoices`, `reminder_sequences`,
`reminder_steps` indirectly via its sequence, `email_templates`,
`reminder_events`, `audit_logs`) carries `organizationId`. **Every repository
query filters by it.** A record is looked up with
`.eq("id", id).eq("organizationId", organizationId).maybeSingle()`, never a
bare id lookup — so a user who knows another org's UUID gets a 404, not a
403 (never confirms the record even exists). This is exercised directly in
`tests/tenancy.test.ts`.

The service-role key (used by the one Supabase client in `src/db/supabase.ts`)
bypasses Row Level Security entirely — tenant isolation is enforced in the
application layer, not the database. That key must never reach the frontend.

A user's "active" organization for a given request is embedded directly in
their JWT access token at login/register time (`organizationId`, `role`).
**V1 simplification:** since there's no organization-switching endpoint yet,
it's simply the first organization the user joined (registration always
creates exactly one). The token shape already supports per-org roles, so
adding an org switcher / invite flow later doesn't require a schema change.

### The reminder engine (no Redis required)

1. An invoice is created with a `reminderSequenceId` (or one is attached
   later) → `reminder_events` rows are inserted, one per step, `status:
   PENDING`, `scheduledAt` computed from the due date + the step's
   `delayDays`, resolved in **the organization's own timezone**
   (`utils/dates.ts`).
2. Nothing is sent yet — `scheduledAt` is just a future timestamp.
3. Every `CRON_INTERVAL_MINUTES`, `jobs/runner.ts` fires a tick that:
   - recovers any event stuck in `PROCESSING` (a worker crashed mid-send),
   - re-derives `SENT → DUE → OVERDUE` invoice statuses in each org's timezone,
   - runs the reminder worker.
4. The worker claims due events via the `claim_due_reminder_events` Postgres
   function (`supabase/migrations/0001_init.sql`), which runs
   `SELECT ... FOR UPDATE SKIP LOCKED` inside the function's own implicit
   transaction — this is the entire concurrency story. Two overlapping ticks
   (or two worker processes) can never claim the same row; no queue/broker
   needed. PostgREST (what supabase-js talks to) has no client-side
   transaction API, so this — and every other place that needs multi-
   statement atomicity (registration, reminder-sequence creation, step
   updates) — is a Postgres function (RPC) instead.
5. For each claimed event, the invoice's *current* state is re-checked (paid?
   cancelled? paused?) right before sending — the claim lock only protects
   the event row, not the invoice row, so this is the actual enforcement of
   "paid/cancelled/paused invoices never get reminders."
6. On success: `status → SENT`, `sentAt` set, `providerMessageId` recorded.
   On failure: attempts++, exponential backoff (5m → 30m → 2h, configurable
   via `MAX_EMAIL_RETRIES`) via `jobs/retry-worker.ts`, or `FAILED` once
   retries are exhausted.
7. A `unique ("invoiceId", "reminderStepId")` constraint on `reminder_events`
   is the hard backstop against ever sending the same reminder twice, even
   under a bug in the application layer.

Run the jobs in the same process as the API (default, simplest — fine at V1
scale) or as a separate `npm run worker:start` process/service once you want
to scale the reminder engine independently; set `RUN_JOBS_IN_API_PROCESS=false`
on the API service if you do, so the two don't double-process the same queue.

### Money & dates

- Amounts are stored as **integer minor units** (cents) — `utils/money.ts` is
  the only place major/minor conversion happens, at the API edge. Never a
  float touches persistence or arithmetic.
- `issueDate`/`dueDate` are calendar dates (no time component) stored as
  UTC-midnight timestamps. Reminder scheduling resolves "N days after the
  due date" to an actual instant using the **organization's** timezone
  (`utils/dates.ts`), not the server's — a due date of "Sep 4" means the same
  calendar day everywhere the org operates from, regardless of where the
  container happens to run.
- Supabase (PostgREST) returns timestamp columns as ISO strings, not JS
  `Date` objects — `src/db/mappers.ts` converts each table's own date
  columns back into `Date`s at the repository boundary, so the rest of the
  codebase (`.getTime()`, date-fns, etc.) never has to think about it.

## Requirements

- Node.js 20+
- A [Supabase](https://supabase.com) project — **the only database NudgePay
  uses, in every environment.** There is no local Postgres to install or run,
  and no Docker involved anywhere in this project.

## Supabase setup

1. Create a Supabase project (free tier is fine to start).
2. Project Settings → API → copy the **Project URL** and the
   **`service_role` secret key** → `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.
   This key bypasses Row Level Security — keep it backend-only, never send it
   to the frontend.
3. Project Settings → Database → Connection string → copy the **direct**
   connection (port `5432`, no pgbouncer) → `DIRECT_URL`. This is used only
   by `npm run db:migrate` to apply schema/RPC changes — PostgREST (what the
   running app talks to) can't execute DDL, so migrations need a real
   Postgres connection; the app itself never reads this variable.
4. `cp .env.example .env` and fill in all three, plus real
   `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (`openssl rand -hex 32`).

```bash
npm install
npm run db:migrate     # applies supabase/migrations/*.sql (uses DIRECT_URL)
npm run db:seed        # loads a demo organization + invoices
npm run dev            # starts the API on http://localhost:4000
```

Swagger UI: `http://localhost:4000/docs`. Health check: `GET /health` (also
verifies the Supabase connection). Inspect data directly in the Supabase
dashboard's Table Editor, or:

```bash
npm run db:clean   # wipes every table — destructive, no confirmation prompt
```

Seeded login: `owner@example.com` / `password123` (organization "Acme Digital
Agency", a handful of clients and invoices in different states — paid, due
soon, overdue, and overdue with a full reminder history).

## Environment variables

See `.env.example` for the full list with comments. The important ones:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | What the running app actually uses to reach the database |
| `DIRECT_URL` | Direct (non-pooled) Postgres connection — used only by `npm run db:migrate`, never by the app |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Must be different, long, random. Never reuse across environments. |
| `ACCESS_TOKEN_EXPIRES_IN` / `REFRESH_TOKEN_EXPIRES_IN` | e.g. `15m`, `7d` |
| `EMAIL_SERVICE_URL` / `EMAIL_SERVICE_API_KEY` | NudgePay's shared HTTP email endpoint (not Resend, no SMTP). Leave the key empty in dev — falls back to a console provider that logs emails instead of sending them |
| `APP_URL` | The backend's own base URL (shown as the Swagger "server") — not the frontend's |
| `CORS_ORIGIN` | The frontend's origin, so the API accepts requests from it |
| `CRON_INTERVAL_MINUTES` | How often the reminder engine ticks |
| `MAX_EMAIL_RETRIES` | Attempts before a reminder is marked permanently `FAILED` |
| `RUN_JOBS_IN_API_PROCESS` | `false` if running `worker:start` as a separate service |

Environment variables are validated with zod at boot (`src/config/env.ts`) —
the process refuses to start with a missing/malformed value rather than
failing confusingly later.

## Database & migrations

Schema changes are plain SQL files in `supabase/migrations/`, applied in
filename order by the small custom runner in `scripts/migrate.ts` (it just
tracks what's already been applied in a `_migrations` table — no Supabase
CLI, no Docker required).

```bash
npm run db:migrate   # apply any not-yet-applied migrations (needs DIRECT_URL)
npm run db:seed      # (re-)load demo data — safe to re-run, see scripts/seed.ts
npm run db:clean     # wipe every table — destructive, dev/test only
```

To add a schema change: add a new `supabase/migrations/000N_description.sql`
file (never edit an already-applied one) and run `npm run db:migrate` again.

## Running

```bash
npm run dev            # API + reminder engine in-process, with reload
npm run build && npm start   # production build

# Only if you've split the reminder engine into its own service:
npm run worker:dev
npm run build && npm run worker:start
```

## Testing

```bash
npm test          # single run
npm run test:watch
```

Tests need their own database — **never point them at one with real data**,
the suite truncates every table before each test file via the
`truncate_all_tables()` RPC. The recommended option is a second, free
Supabase project used only for tests:

```bash
# .env.test (or export inline) — a second/throwaway Supabase project, not the one with real data
NODE_ENV=test
SUPABASE_URL=<your test project's URL>
SUPABASE_SERVICE_ROLE_KEY=<your test project's service-role key>
DIRECT_URL=<your test project's direct connection string>
JWT_ACCESS_SECRET=test-access-secret-please-change
JWT_REFRESH_SECRET=test-refresh-secret-please-change

npm run db:migrate   # with the env above loaded
npm test              # with the env above loaded
```

Coverage: registration/login/refresh/invalid-credentials, cross-organization
isolation for clients and invoices, the full invoice lifecycle (create,
update, mark-paid, cancel, pause/resume reminders, draft-only delete), the
reminder engine (schedule calculation, overdue detection, dispatch, no
double-sends, retry/backoff to permanent failure, paid/paused suppression,
resume realignment), and dashboard aggregation.

Tests use Fastify's built-in `.inject()` instead of spinning up a real HTTP
server, and swap in a fake `EmailProvider` (`setEmailProvider`) instead of
hitting the real email service.

## API documentation

Swagger UI is served at `/docs` (OpenAPI 3 JSON at `/docs/json`), generated
directly from the Zod schemas each route declares — the schemas are the
single source of truth for validation, TypeScript types, and docs, so they
can't drift from each other. All endpoints are under `/api/v1`.

Response envelope, applied consistently everywhere:

```jsonc
// success
{ "success": true, "data": { /* ... */ } }
// paginated list
{ "success": true, "data": { "items": [], "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 } } }
// error
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Client not found" } }
```

## Security notes

- Helmet, CORS (configurable origin allowlist), global + auth-specific rate
  limiting, request IDs on every response (`X-Request-Id`).
- Passwords hashed with bcrypt (cost 12); refresh tokens are opaque JWTs
  whose **hash only** is persisted, with rotation and reuse detection (a
  replayed, already-rotated refresh token revokes the whole session chain).
- The centralized error handler never leaks stack traces or raw driver
  errors in production — only `AppError` subclasses' intentional messages,
  or a generic "unexpected error" for anything unrecognized. Database errors
  (unique/foreign-key violations) are mapped to the same safe `AppError`
  shape in `src/db/supabase.ts`, right where they occur.
- Structured logging (Pino) redacts `Authorization` headers, passwords, and
  tokens by path, everywhere, including inside the job runner.
- The Supabase **service-role key bypasses Row Level Security** — this is a
  deliberate tradeoff (tenant isolation is enforced in the application layer
  instead, exactly as it would be with any ORM), not an oversight. That key
  is backend-only and must never be shipped to a frontend or client.

## Production deployment considerations

- **Database**: Supabase Postgres, in every environment — there is no local
  or self-managed Postgres anywhere in this stack. Run `npm run db:migrate`
  as a release step whenever `supabase/migrations/` has new files.
- **Process model**: a single service running `npm start` covers the API and
  the reminder engine together at V1 scale. If reminder volume grows enough
  to want independent scaling/restarts, deploy `npm run worker:start` as a
  second service and set `RUN_JOBS_IN_API_PROCESS=false` on the API service.
- **Secrets**: set `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`/
  `SUPABASE_SERVICE_ROLE_KEY`/`EMAIL_SERVICE_API_KEY` via your platform's
  secret manager, never in a committed file. Rotate the JWT secrets and
  every existing refresh token is invalidated at once — acceptable for a
  security incident response, so keep that in mind.
- **CORS**: set `CORS_ORIGIN` to your real frontend origin(s) (comma-
  separated for more than one) — the wildcard-friendly local default is not
  safe for production.
- **Email**: without `EMAIL_SERVICE_API_KEY` set, the app silently logs
  emails instead of sending them — intentional for a demo/staging
  environment, but double-check it's set before you expect real reminders to
  go out.
- **Horizontal scaling**: the worker's `FOR UPDATE SKIP LOCKED` claim (inside
  the `claim_due_reminder_events` RPC) is safe to run from multiple instances
  concurrently — no coordination needed beyond Postgres itself.

## V1 scope, deliberately

No QuickBooks/Xero/Stripe integration, no payment processing, no SMS, no
AI-generated copy, no recurring invoices, no subscription billing, no team
chat. Users enter clients/invoices manually; NudgePay's job is exclusively
the follow-up automation. The `EmailProvider` interface, the modular service
boundaries, and organization-scoped everything are deliberately shaped so
that QuickBooks/Xero sync, Stripe billing, a second notification channel, or
a Redis-backed queue can be added later without a rewrite — none of that is
built now.
