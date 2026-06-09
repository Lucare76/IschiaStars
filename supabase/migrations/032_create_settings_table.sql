create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

-- Solo il service role (admin) può leggere e scrivere
create policy "service role only" on public.settings
  using (false)
  with check (false);
