-- Email tracking: logs every Brevo transactional email with delivery/open/click status
create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references public.quotes(id) on delete set null,
  confirmation_id uuid references public.quote_confirmations(id) on delete set null,
  email_type text not null check (email_type in (
    'quote_to_client',
    'confirmation_internal',
    'final_confirmation_to_client',
    'voucher_to_client',
    'supplier_confirmation',
    'unavailability_to_client'
  )),
  recipient_email text not null,
  brevo_message_id text,
  subject text,
  status text not null default 'sent' check (status in (
    'sent',
    'failed',
    'delivered',
    'opened',
    'clicked',
    'soft_bounce',
    'hard_bounce',
    'blocked',
    'error',
    'deferred'
  )),
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  last_event_at timestamptz,
  error_message text,
  raw_events jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_logs_quote_id_idx on public.email_logs(quote_id);
create index if not exists email_logs_confirmation_id_idx on public.email_logs(confirmation_id);
create index if not exists email_logs_brevo_message_id_idx on public.email_logs(brevo_message_id);
create index if not exists email_logs_email_type_idx on public.email_logs(email_type);
create index if not exists email_logs_status_idx on public.email_logs(status);

alter table public.email_logs enable row level security;

-- Solo service_role può accedere a email_logs (scritto/letto server-side via createSupabaseAdminClient)
drop policy if exists "operators read email logs" on public.email_logs;
drop policy if exists "operators create email logs" on public.email_logs;
drop policy if exists "service role only" on public.email_logs;
create policy "service role only" on public.email_logs using (false) with check (false);

revoke all on public.email_logs from anon;
revoke all on public.email_logs from authenticated;
grant select, insert, update, delete on public.email_logs to service_role;
