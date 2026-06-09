alter table public.quote_confirmations
  add column if not exists balance_paid_at timestamptz default null;
