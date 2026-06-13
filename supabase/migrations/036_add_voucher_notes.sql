alter table public.quote_confirmations
  add column if not exists voucher_notes text;
