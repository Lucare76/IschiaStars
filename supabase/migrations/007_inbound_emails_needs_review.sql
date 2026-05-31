create table if not exists public.inbound_emails (
  id uuid primary key default gen_random_uuid(),
  gmail_message_id text not null unique,
  rfc_message_id text,
  subject text,
  received_at timestamptz,
  status text not null default 'needs_review',
  skipped_reason text,
  headers jsonb not null default '[]'::jsonb,
  body_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inbound_emails drop constraint if exists inbound_emails_status_check;
alter table public.inbound_emails add constraint inbound_emails_status_check check (status in ('needs_review','imported','skipped'));

create index if not exists inbound_emails_status_idx on public.inbound_emails(status);
create index if not exists inbound_emails_received_at_idx on public.inbound_emails(received_at desc);

alter table public.inbound_emails enable row level security;
drop policy if exists "operators manage inbound emails" on public.inbound_emails;
create policy "operators manage inbound emails" on public.inbound_emails for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.inbound_emails to authenticated, service_role;
