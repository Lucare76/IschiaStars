alter table public.quote_requests add column if not exists deleted_at timestamptz;
alter table public.quote_requests add column if not exists deleted_by text;
alter table public.quote_requests add column if not exists delete_reason text;
alter table public.quote_requests add column if not exists excluded_from_stats boolean not null default false;

create index if not exists quote_requests_deleted_at_idx on public.quote_requests(deleted_at) where deleted_at is not null;
create index if not exists quote_requests_active_status_idx on public.quote_requests(status, created_at desc) where deleted_at is null;
update public.quote_requests
set deleted_at = coalesce(deleted_at, now()),
    deleted_by = coalesce(deleted_by, 'migration'),
    delete_reason = coalesce(delete_reason, 'duplicate_gmail_message_id'),
    excluded_from_stats = true,
    updated_at = now()
where deleted_at is null
  and id in (
    select id from (
      select id,
             row_number() over (
               partition by metadata->>'gmail_message_id'
               order by created_at asc
             ) as rn
      from public.quote_requests
      where metadata->>'gmail_message_id' is not null
        and deleted_at is null
    ) ranked
    where rn > 1
  );
drop index if exists public.quote_requests_gmail_message_id_uidx;
create unique index quote_requests_gmail_message_id_uidx
  on public.quote_requests ((metadata->>'gmail_message_id'))
  where metadata->>'gmail_message_id' is not null and deleted_at is null;

create table if not exists public.email_import_ledger (
  id uuid primary key default gen_random_uuid(),
  gmail_message_id text not null unique,
  gmail_thread_id text,
  rfc_message_id text,
  subject text,
  from_email text,
  to_emails text[],
  cc_emails text[],
  received_at timestamptz,
  processed_at timestamptz not null default now(),
  status text not null,
  quote_request_id uuid references public.quote_requests(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_import_ledger drop constraint if exists email_import_ledger_status_check;
alter table public.email_import_ledger add constraint email_import_ledger_status_check
  check (status in (
    'imported',
    'duplicate',
    'ignored_non_quote',
    'needs_review',
    'parse_failed',
    'deleted_by_admin',
    'archived_by_admin'
  ));

create index if not exists email_import_ledger_status_idx on public.email_import_ledger(status);
create index if not exists email_import_ledger_received_at_idx on public.email_import_ledger(received_at desc);
create index if not exists email_import_ledger_quote_request_id_idx on public.email_import_ledger(quote_request_id);

insert into public.email_import_ledger (
  gmail_message_id,
  rfc_message_id,
  subject,
  received_at,
  status,
  metadata,
  created_at,
  updated_at
)
select
  inbound.gmail_message_id,
  inbound.rfc_message_id,
  inbound.subject,
  inbound.received_at,
  case
    when inbound.status = 'imported' then 'imported'
    when inbound.status = 'needs_review' then 'needs_review'
    else 'ignored_non_quote'
  end,
  jsonb_strip_nulls(jsonb_build_object(
    'source', 'backfill_inbound_emails',
    'skipped_reason', inbound.skipped_reason
  )),
  inbound.created_at,
  inbound.updated_at
from public.inbound_emails inbound
on conflict (gmail_message_id) do nothing;

insert into public.email_import_ledger (
  gmail_message_id,
  rfc_message_id,
  subject,
  received_at,
  status,
  quote_request_id,
  metadata,
  created_at,
  updated_at
)
select
  request.metadata->>'gmail_message_id',
  request.metadata->>'gmail_rfc_message_id',
  request.metadata->>'email_subject',
  request.created_at,
  case when request.deleted_at is null then 'imported' else 'deleted_by_admin' end,
  request.id,
  jsonb_strip_nulls(jsonb_build_object(
    'source', 'backfill_quote_requests',
    'deleted_at', request.deleted_at,
    'delete_reason', request.delete_reason
  )),
  request.created_at,
  request.updated_at
from public.quote_requests request
where request.metadata->>'gmail_message_id' is not null
on conflict (gmail_message_id) do update
set quote_request_id = coalesce(public.email_import_ledger.quote_request_id, excluded.quote_request_id),
    status = case
      when public.email_import_ledger.status in ('deleted_by_admin', 'archived_by_admin') then public.email_import_ledger.status
      else excluded.status
    end,
    updated_at = now();

alter table public.email_import_ledger enable row level security;
drop policy if exists "operators manage email import ledger" on public.email_import_ledger;
drop policy if exists "operators read email import ledger" on public.email_import_ledger;
drop policy if exists "operators insert email import ledger" on public.email_import_ledger;
drop policy if exists "operators update email import ledger" on public.email_import_ledger;
create policy "operators read email import ledger" on public.email_import_ledger for select to authenticated using (true);
create policy "operators insert email import ledger" on public.email_import_ledger for insert to authenticated with check (true);
create policy "operators update email import ledger" on public.email_import_ledger for update to authenticated using (true) with check (true);
grant select, insert, update on public.email_import_ledger to authenticated, service_role;
