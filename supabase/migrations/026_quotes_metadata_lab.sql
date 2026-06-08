alter table public.quotes
  add column if not exists metadata jsonb not null default '{}'::jsonb;
