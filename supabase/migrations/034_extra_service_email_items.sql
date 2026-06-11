create table if not exists public.extra_service_email_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  price_from numeric(10,2) not null check (price_from >= 0),
  price_suffix text not null default 'a persona',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists extra_service_email_items_sort_order_idx
  on public.extra_service_email_items(sort_order, created_at);

alter table public.extra_service_email_items enable row level security;

drop policy if exists "service role only" on public.extra_service_email_items;
create policy "service role only" on public.extra_service_email_items
  using (false)
  with check (false);

grant select, insert, update, delete on public.extra_service_email_items to service_role;

insert into public.extra_service_email_items (title, price_from, price_suffix, is_active, sort_order)
select seed.title, seed.price_from, 'a persona', true, seed.sort_order
from (
  values
    ('Traghetto da Pozzuoli + transfer alla struttura', 30::numeric, 1),
    ('Traghetto da Napoli + transfer alla struttura', 33::numeric, 2),
    ('Aliscafo da Napoli + transfer alla struttura', 38::numeric, 3),
    ('Treno + trasferimenti + traghetto', 115::numeric, 4),
    ('Bus per Ischia', 90::numeric, 5)
) as seed(title, price_from, sort_order)
where not exists (select 1 from public.extra_service_email_items);
