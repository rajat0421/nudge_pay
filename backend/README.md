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
  <name>.repository.ts    All Prisma queries for this module, always org-scoped
  <name>.schemas.ts        Zod request schemas (source of truth for validation + docs)
  <name>.types.ts          Shared TS types
```

```
src/
  app.ts              Fastify app factory (plugins, routes) — used by server.ts and tests
  server.ts           API process entrypoint
  worker.ts           Standalone reminder-worker process entrypoint (optional, see below)
  config/             env validation (zod), constants, logger
  db/prisma.ts        Prisma client singleton
  middleware/         auth guard, centralized error handler, rate limiting, request IDs
  modules/            auth, users, organizations, clients, invoices, reminders,
                      email, dashboard, audit, health
  jobs/               reminder-scheduler (status sweep), reminder-worker (send),
                      retry-worker (backoff), runner (ties them together on an interval)
  utils/              dates (timezone-safe), money (integer minor units), crypto, pagination
prisma/
  schema.prisma
  seed.ts
tests/
```

### Multi-tenancy

Every tenant-owned row (`Client`, `Invoice`, `ReminderSequence`, `ReminderStep`
indirectly via its sequence, `EmailTemplate`, `ReminderEvent`, `AuditLog`)
carries `organizationId`. **Every repository query filters by it.** A record
is looked up with `findFirst({ where: { id, organizationId } })`, never a bare
`findUnique({ where: { id } })` — so a user who knows another org's UUID gets
a 404, not a 403 (never confirms the record even exists). This is exercised
directly in `tests/tenancy.test.ts`.

A user's "active" organization for a given request is embedded directly in
their JWT access token at login/register time (`organizationId`, `role`).
**V1 simplification:** since there's no organization-switching endpoint yet,
it's simply the first organization the user joined (registration always
creates exactly one). The token shape already supports per-org roles, so
adding an org switcher / invite flow later doesn't require a schema change.

### The reminder engine (no Redis required)

1. An invoice is created with a `reminderSequenceId` (or one is attached
   later) → `ReminderEvent` rows are inserted, one per step, `status: PENDING`,
   `scheduledAt` computed from the due date + the step's `delayDays`, resolved
   in **the organization's own timezone** (`utils/dates.ts`).
2. Nothing is sent yet — `scheduledAt` is just a future timestamp.
3. Every `CRON_INTERVAL_MINUTES`, `jobs/runner.ts` fires a tick that:
   - recovers any event stuck in `PROCESSING` (a worker crashed mid-send),
   - re-derives `SENT → DUE → OVERDUE` invoice statuses in each org's timezone,
   - runs the reminder worker.
4. The worker claims due events with `SELECT ... FOR UPDATE SKIP LOCKED`
   inside a transaction (`reminders.repository.claimDueEvents`) — this is the
   entire concurrency story. Two overlapping ticks (or two worker processes)
   can never claim the same row; no queue/broker needed.
5. For each claimed event, the invoice's *current* state is re-checked (paid?
   cancelled? paused?) right before sending — the claim lock only protects
   the event row, not the invoice row, so this is the actual enforcement of
   "paid/cancelled/paused invoices never get reminders."
6. On success: `status → SENT`, `sentAt` set, `providerMessageId` recorded.
   On failure: attempts++, exponential backoff (5m → 30m → 2h, configurable
   via `MAX_EMAIL_RETRIES`) via `jobs/retry-worker.ts`, or `FAILED` once
   retries are exhausted.
7. A `@@unique([invoiceId, reminderStepId])` constraint on `ReminderEvent` is
   the hard backstop against ever sending the same reminder twice, even under
   a bug in the application layer.

Run the jobs in the same process as the API (default, simplest — fine at V1
scale) or as a separate `npm run worker:start` process/service once you want
to scale the reminder engine independently; set `RUN_JOBS_IN_API_PROCESS=false`
on the API service if you do, so the two don't double-process the same queue.

### Money & dates

- Amounts are stored as **integer minor units** (cents) — `utils/money.ts` is
  the only place major/minor conversion happens, at the API edge. Never a
  float touches persistence or arithmetic.
- `issueDate`/`dueDate` are calendar dates (no time component) stored as
  UTC-midnight `DateTime`s. Reminder scheduling resolves "N days after the
  due date" to an actual instant using the **organization's** timezone
  (`utils/dates.ts`), not the server's — a due date of "Sep 4" means the same
  calendar day everywhere the org operates from, regardless of where the
  container happens to run.

## Requirements

- Node.js 20+
- A [Supabase](https://supabase.com) project — **the only database NudgePay
  uses, in every environment.** There is no local Postgres to install or run;
  `docker-compose.yml` in this repo is only for optionally containerizing the
  API itself, not the database.

## Supabase setup

1. Create a Supabase project (free tier is fine to start).
2. Project Settings → Database → Connection string. Copy **both**:
   - the pooled "Transaction" connection string (port `6543`) → `DATABASE_URL`
   - the direct connection string (port `5432`) → `DIRECT_URL`

   Prisma Migrate needs the direct connection — pgbouncer's transaction
   pooling mode (what the pooled URL runs in) can't execute schema
   migrations. The running app uses the pooled URL for everything else,
   since Fastify and the reminder worker open many short-lived connections,
   which is exactly what the pooler exists for.
3. `cp .env.example .env` and fill in both URLs, plus real
   `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (`openssl rand -hex 32`).

```bash
npm install
npm run db:generate    # generate the Prisma client
npm run db:migrate     # applies schema migrations against Supabase (uses DIRECT_URL)
npm run db:seed        # loads a demo organization + invoices
npm run dev            # starts the API on http://localhost:4000
```

Swagger UI: `http://localhost:4000/docs`. Health check: `GET /health` (also
verifies the Supabase connection). Inspect data directly with:

```bash
npx prisma studio
```

Seeded login: `owner@example.com` / `password123` (organization "Acme Digital
Agency", a handful of clients and invoices in different states — paid, due
soon, overdue, and overdue with a full reminder history).

## Environment variables

See `.env.example` for the full list with comments. The important ones:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Supabase's **pooled** connection string (port 6543) — used by the running app |
| `DIRECT_URL` | Supabase's **direct** connection string (port 5432) — used only by `prisma migrate`/`prisma db seed` |
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

```bash
npm run db:generate       # regenerate the Prisma client after a schema change
npm run db:migrate        # create + apply a migration in development (needs DIRECT_URL)
npm run db:migrate:deploy # apply existing migrations only — use this one in CI/production
npm run db:seed           # (re-)run prisma/seed.ts — safe to re-run, see prisma/seed.ts
npm run db:reset          # drop, recreate, migrate, and seed — destructive, dev only
npm run db:studio         # browse/edit data directly (npx prisma studio)
```

**Never run `db:migrate` (`prisma migrate dev`) against production** — it can
prompt interactively and is meant for local schema iteration only. Production
and CI always use `db:migrate:deploy`.

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
the suite truncates every table before each test file. The recommended
option is a second, free Supabase project used only for tests, so nothing
outside Supabase is ever required; use its direct (non-pooled) connection
string as `DATABASE_URL` for tests (no separate `DIRECT_URL` needed there —
tests don't run through pgbouncer):

```bash
# .env.test (or export inline) — a second/throwaway Supabase project, not the one with real data
NODE_ENV=test
DATABASE_URL="<your test Supabase project's direct connection string>"
JWT_ACCESS_SECRET=test-access-secret-please-change
JWT_REFRESH_SECRET=test-refresh-secret-please-change

npx prisma migrate deploy   # with the env above loaded
npm test                    # with the env above loaded
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
  or a generic "unexpected error" for anything unrecognized.
- Structured logging (Pino) redacts `Authorization` headers, passwords, and
  tokens by path, everywhere, including inside the job runner.

## Production deployment considerations

- **Database**: Supabase Postgres, in every environment — there is no local
  or self-managed Postgres anywhere in this stack. Run `db:migrate:deploy`
  (`prisma migrate deploy`) as a release step, never `db:migrate`
  (`prisma migrate dev`), which is interactive and meant for local iteration
  only. Point `DIRECT_URL` at Supabase's direct connection for the migration
  step; the running app itself only ever needs the pooled `DATABASE_URL`.
- **Process model**: a single service running `npm start` covers the API and
  the reminder engine together at V1 scale. If reminder volume grows enough
  to want independent scaling/restarts, deploy `npm run worker:start` as a
  second service and set `RUN_JOBS_IN_API_PROCESS=false` on the API service.
- **Secrets**: set `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`/`EMAIL_SERVICE_API_KEY`
  via your platform's secret manager, never in a committed file. Rotate the
  JWT secrets and every existing refresh token is invalidated at once —
  acceptable for a security incident response, so keep that in mind.
- **CORS**: set `CORS_ORIGIN` to your real frontend origin(s) (comma-
  separated for more than one) — the wildcard-friendly local default is not
  safe for production.
- **Email**: without `EMAIL_SERVICE_API_KEY` set, the app silently logs
  emails instead of sending them — intentional for a demo/staging
  environment, but double-check it's set before you expect real reminders to
  go out.
- **Horizontal scaling**: the worker's `FOR UPDATE SKIP LOCKED` claim is safe
  to run from multiple instances concurrently — no coordination needed beyond
  Postgres itself.

## V1 scope, deliberately

No QuickBooks/Xero/Stripe integration, no payment processing, no SMS, no
AI-generated copy, no recurring invoices, no subscription billing, no team
chat. Users enter clients/invoices manually; NudgePay's job is exclusively
the follow-up automation. The `EmailProvider` interface, the modular service
boundaries, and organization-scoped everything are deliberately shaped so
that QuickBooks/Xero sync, Stripe billing, a second notification channel, or
a Redis-backed queue can be added later without a rewrite — none of that is
built now.
