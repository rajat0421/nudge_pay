-- NudgePay backend — full schema for Supabase Postgres. Table names are
-- snake_case; column names stay camelCase (quoted) to match the field names
-- used throughout the application code exactly. Monetary values are
-- integers in minor units (cents) — never floats. Every tenant-owned table
-- carries "organizationId".

create extension if not exists pgcrypto;

-- An earlier version of this schema used TEXT id columns (with a
-- text-side uuid default) instead of native `uuid` columns — incompatible
-- with the schema below, which uses real `uuid` columns throughout
-- (required for the FK-typed RPC parameters further down). Dropping and
-- recreating is safe here: this is a dev/seed database with no real user
-- data. Order matters (children before parents).
drop table if exists audit_logs cascade;
drop table if exists reminder_events cascade;
drop table if exists reminder_steps cascade;
drop table if exists email_templates cascade;
drop table if exists reminder_sequences cascade;
drop table if exists invoices cascade;
drop table if exists clients cascade;
drop table if exists refresh_tokens cascade;
drop table if exists organization_members cascade;
drop table if exists organizations cascade;
drop table if exists users cascade;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type organization_role as enum ('OWNER', 'ADMIN', 'MEMBER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invoice_status as enum ('DRAFT', 'SENT', 'DUE', 'OVERDUE', 'PAID', 'CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reminder_event_status as enum ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- updatedAt trigger helper
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  "passwordHash" text not null,
  "firstName" text not null,
  "lastName" text not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "lastLoginAt" timestamptz
);
drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at before update on users
  for each row execute function set_updated_at();

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'UTC',
  currency text not null default 'USD',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
drop trigger if exists trg_organizations_updated_at on organizations;
create trigger trg_organizations_updated_at before update on organizations
  for each row execute function set_updated_at();

create table if not exists organization_members (
  id uuid primary key default gen_random_uuid(),
  "organizationId" uuid not null references organizations(id) on delete cascade,
  "userId" uuid not null references users(id) on delete cascade,
  role organization_role not null default 'MEMBER',
  "createdAt" timestamptz not null default now(),
  unique ("organizationId", "userId")
);
create index if not exists idx_organization_members_user on organization_members("userId");

-- Refresh tokens are never stored in plaintext — only a SHA-256 hash of the
-- token is persisted. Rotation replaces a row's hash pointer so a reused
-- (stolen) refresh token can be detected and the whole chain revoked.
create table if not exists refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null references users(id) on delete cascade,
  "tokenHash" text not null unique,
  "expiresAt" timestamptz not null,
  "revokedAt" timestamptz,
  "replacedByTokenHash" text,
  "createdAt" timestamptz not null default now()
);
create index if not exists idx_refresh_tokens_user on refresh_tokens("userId");

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  "organizationId" uuid not null references organizations(id) on delete cascade,
  name text not null,
  "companyName" text,
  email text not null,
  phone text,
  notes text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index if not exists idx_clients_org on clients("organizationId");
create index if not exists idx_clients_org_email on clients("organizationId", email);
drop trigger if exists trg_clients_updated_at on clients;
create trigger trg_clients_updated_at before update on clients
  for each row execute function set_updated_at();

create table if not exists reminder_sequences (
  id uuid primary key default gen_random_uuid(),
  "organizationId" uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  "isActive" boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index if not exists idx_reminder_sequences_org on reminder_sequences("organizationId");
drop trigger if exists trg_reminder_sequences_updated_at on reminder_sequences;
create trigger trg_reminder_sequences_updated_at before update on reminder_sequences
  for each row execute function set_updated_at();

create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  "organizationId" uuid not null references organizations(id) on delete cascade,
  name text not null,
  subject text not null,
  body text not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index if not exists idx_email_templates_org on email_templates("organizationId");
drop trigger if exists trg_email_templates_updated_at on email_templates;
create trigger trg_email_templates_updated_at before update on email_templates
  for each row execute function set_updated_at();

create table if not exists reminder_steps (
  id uuid primary key default gen_random_uuid(),
  "reminderSequenceId" uuid not null references reminder_sequences(id) on delete cascade,
  "stepOrder" integer not null,
  "delayDays" integer not null,
  "emailTemplateId" uuid not null references email_templates(id) on delete restrict,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("reminderSequenceId", "stepOrder")
);
drop trigger if exists trg_reminder_steps_updated_at on reminder_steps;
create trigger trg_reminder_steps_updated_at before update on reminder_steps
  for each row execute function set_updated_at();

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  "organizationId" uuid not null references organizations(id) on delete cascade,
  "clientId" uuid not null references clients(id) on delete restrict,
  "reminderSequenceId" uuid references reminder_sequences(id) on delete set null,
  "invoiceNumber" text not null,
  amount integer not null,
  currency text not null default 'USD',
  "issueDate" timestamptz not null,
  "dueDate" timestamptz not null,
  "paymentUrl" text,
  status invoice_status not null default 'DRAFT',
  "paidAt" timestamptz,
  "remindersPaused" boolean not null default false,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("organizationId", "invoiceNumber")
);
create index if not exists idx_invoices_org_status on invoices("organizationId", status);
create index if not exists idx_invoices_org_duedate on invoices("organizationId", "dueDate");
drop trigger if exists trg_invoices_updated_at on invoices;
create trigger trg_invoices_updated_at before update on invoices
  for each row execute function set_updated_at();

-- One row per (invoice, step) — the unique constraint is the hard backstop
-- against ever sending the same reminder twice, even under concurrent workers.
create table if not exists reminder_events (
  id uuid primary key default gen_random_uuid(),
  "organizationId" uuid not null references organizations(id) on delete cascade,
  "invoiceId" uuid not null references invoices(id) on delete cascade,
  "reminderStepId" uuid not null references reminder_steps(id) on delete restrict,
  "scheduledAt" timestamptz not null,
  "sentAt" timestamptz,
  status reminder_event_status not null default 'PENDING',
  attempts integer not null default 0,
  "providerMessageId" text,
  "lastError" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("invoiceId", "reminderStepId")
);
create index if not exists idx_reminder_events_status_scheduled on reminder_events(status, "scheduledAt");
create index if not exists idx_reminder_events_org on reminder_events("organizationId");
drop trigger if exists trg_reminder_events_updated_at on reminder_events;
create trigger trg_reminder_events_updated_at before update on reminder_events
  for each row execute function set_updated_at();

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  "organizationId" uuid not null references organizations(id) on delete cascade,
  "userId" uuid references users(id) on delete set null,
  action text not null,
  "entityType" text not null,
  "entityId" text not null,
  metadata jsonb,
  "createdAt" timestamptz not null default now()
);
create index if not exists idx_audit_logs_org_created on audit_logs("organizationId", "createdAt");

-- ---------------------------------------------------------------------------
-- RPCs — everything that needs multi-statement atomicity or row locking.
-- PostgREST (what supabase-js talks to) has no client-side transaction API;
-- a single SQL function call is the only way to get one, so anything
-- needing atomicity across multiple inserts/updates lives here instead.
-- ---------------------------------------------------------------------------

-- Registration: user + organization + OWNER membership, atomically.
create or replace function register_user_with_organization(
  p_email text,
  p_password_hash text,
  p_first_name text,
  p_last_name text,
  p_organization_name text
) returns jsonb
language plpgsql
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
begin
  insert into users (email, "passwordHash", "firstName", "lastName")
  values (p_email, p_password_hash, p_first_name, p_last_name)
  returning id into v_user_id;

  insert into organizations (name)
  values (p_organization_name)
  returning id into v_org_id;

  insert into organization_members ("organizationId", "userId", role)
  values (v_org_id, v_user_id, 'OWNER');

  return jsonb_build_object(
    'user', (select to_jsonb(u) from users u where u.id = v_user_id),
    'organization', (select to_jsonb(o) from organizations o where o.id = v_org_id)
  );
end;
$$;

-- Reminder sequence creation: one sequence + N templates + N steps, atomically.
-- p_steps is a jsonb array of {delayDays, subject, body}, in the intended step order.
create or replace function create_reminder_sequence_with_steps(
  p_organization_id uuid,
  p_name text,
  p_description text,
  p_is_active boolean,
  p_steps jsonb
) returns uuid
language plpgsql
as $$
declare
  v_sequence_id uuid;
  v_template_id uuid;
  v_step jsonb;
  v_index integer := 0;
begin
  insert into reminder_sequences ("organizationId", name, description, "isActive")
  values (p_organization_id, p_name, p_description, coalesce(p_is_active, true))
  returning id into v_sequence_id;

  for v_step in select * from jsonb_array_elements(p_steps)
  loop
    v_index := v_index + 1;

    insert into email_templates ("organizationId", name, subject, body)
    values (
      p_organization_id,
      p_name || ' — step ' || v_index,
      v_step->>'subject',
      v_step->>'body'
    )
    returning id into v_template_id;

    insert into reminder_steps ("reminderSequenceId", "stepOrder", "delayDays", "emailTemplateId")
    values (v_sequence_id, v_index, (v_step->>'delayDays')::integer, v_template_id);
  end loop;

  return v_sequence_id;
end;
$$;

-- Step + its template updated together, atomically.
create or replace function update_reminder_step_and_template(
  p_step_id uuid,
  p_email_template_id uuid,
  p_delay_days integer,
  p_subject text,
  p_body text
) returns void
language plpgsql
as $$
begin
  if p_delay_days is not null then
    update reminder_steps set "delayDays" = p_delay_days where id = p_step_id;
  end if;

  if p_subject is not null or p_body is not null then
    update email_templates
    set
      subject = coalesce(p_subject, subject),
      body = coalesce(p_body, body)
    where id = p_email_template_id;
  end if;
end;
$$;

-- The entire race-condition defense for the reminder engine: atomically
-- claims up to p_limit due PENDING events using FOR UPDATE SKIP LOCKED, so
-- overlapping ticks/worker processes can never claim the same row.
create or replace function claim_due_reminder_events(p_limit integer)
returns setof reminder_events
language plpgsql
as $$
begin
  return query
  update reminder_events
  set status = 'PROCESSING'
  where id in (
    select re.id from reminder_events re
    where re.status = 'PENDING' and re."scheduledAt" <= now()
    order by re."scheduledAt" asc
    limit p_limit
    for update skip locked
  )
  returning *;
end;
$$;

-- Crash recovery: events stuck in PROCESSING past the threshold go back to
-- PENDING so a dead worker can never silently swallow a reminder forever.
create or replace function recover_stuck_processing_events(p_older_than timestamptz)
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  update reminder_events
  set status = 'PENDING'
  where status = 'PROCESSING' and "updatedAt" < p_older_than;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Dashboard summary aggregates (sums/counts) — PostgREST's REST query
-- language has no generic SUM/aggregate support, so this is the efficient
-- (single round-trip, computed in the database) alternative to pulling every
-- matching invoice's amount into the app and summing it in JS.
create or replace function get_dashboard_summary(p_organization_id uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'outstandingAmount', coalesce((
      select sum(amount) from invoices
      where "organizationId" = p_organization_id and status in ('SENT', 'DUE', 'OVERDUE')
    ), 0),
    'overdueAmount', coalesce((
      select sum(amount) from invoices
      where "organizationId" = p_organization_id and status = 'OVERDUE'
    ), 0),
    'paidThisMonth', coalesce((
      select sum(amount) from invoices
      where "organizationId" = p_organization_id and status = 'PAID'
        and "paidAt" >= date_trunc('month', now())
    ), 0),
    'totalInvoices', (
      select count(*) from invoices where "organizationId" = p_organization_id
    ),
    'overdueCount', (
      select count(*) from invoices
      where "organizationId" = p_organization_id and status = 'OVERDUE'
    )
  );
$$;

-- Dev/test only — wipes every table. Never run against a database with real data.
create or replace function truncate_all_tables()
returns void
language plpgsql
as $$
begin
  truncate table
    audit_logs,
    reminder_events,
    reminder_steps,
    email_templates,
    reminder_sequences,
    invoices,
    clients,
    refresh_tokens,
    organization_members,
    organizations,
    users
  restart identity cascade;
end;
$$;

-- Make sure PostgREST picks up the new tables/relationships/functions immediately.
notify pgrst, 'reload schema';
