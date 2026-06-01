alter table public.quote_requests add column if not exists received_at timestamptz;

update public.quote_requests
set received_at = (metadata->>'email_date')::timestamptz
where received_at is null
  and metadata->>'email_date' is not null;

update public.quote_requests
set received_at = created_at
where received_at is null;

create index if not exists quote_requests_received_at_idx on public.quote_requests(received_at desc);
