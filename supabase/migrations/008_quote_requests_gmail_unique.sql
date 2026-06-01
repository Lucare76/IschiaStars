-- Step 1: remove duplicate quote_requests caused by concurrent Gmail imports.
-- For each gmail_message_id, keep the earliest record (min created_at) and delete the rest.
delete from public.quote_requests
where id in (
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

-- Step 2: add a unique index so this can never happen again at the DB level.
create unique index if not exists quote_requests_gmail_message_id_uidx
  on public.quote_requests ((metadata->>'gmail_message_id'))
  where metadata->>'gmail_message_id' is not null;
