alter table public.quote_confirmations
  add column if not exists deposit_paid_at timestamptz default null;
