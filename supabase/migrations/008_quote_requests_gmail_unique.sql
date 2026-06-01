-- Step 1: soft-delete duplicate quote_requests caused by concurrent Gmail imports.
-- For each gmail_message_id, keep the earliest active record and archive the rest.
alter table public.quote_requests add column if not exists deleted_at timestamptz;
alter table public.quote_requests add column if not exists deleted_by text;
alter table public.quote_requests add column if not exists delete_reason text;

update public.quote_requests
set deleted_at = coalesce(deleted_at, now()),
    deleted_by = coalesce(deleted_by, 'migration'),
    delete_reason = coalesce(delete_reason, 'duplicate_gmail_message_id'),
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
  ) ranked
  where rn > 1
);

-- Step 2: add a unique index for active rows. The durable cross-delete guard is email_import_ledger.
create unique index if not exists quote_requests_gmail_message_id_uidx
  on public.quote_requests ((metadata->>'gmail_message_id'))
  where metadata->>'gmail_message_id' is not null and deleted_at is null;
