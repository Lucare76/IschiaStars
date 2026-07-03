update public.extra_service_email_items
set
  title = 'Traghetto da Napoli A/R con transfer',
  price_from = 33::numeric,
  price_suffix = 'per persona',
  is_active = true,
  sort_order = least(sort_order, 2),
  updated_at = now()
where lower(title) in (
  lower('Traghetto da Napoli + transfer alla struttura'),
  lower('Traghetto da Napoli A/R con transfer')
);

insert into public.extra_service_email_items (title, price_from, price_suffix, is_active, sort_order)
select 'Traghetto da Napoli A/R con transfer', 33::numeric, 'per persona', true, 2
where not exists (
  select 1
  from public.extra_service_email_items
  where lower(title) = lower('Traghetto da Napoli A/R con transfer')
     or lower(title) = lower('Traghetto da Napoli + transfer alla struttura')
);

insert into public.extra_service_email_items (title, price_from, price_suffix, is_active, sort_order)
select 'Quota cane', 20::numeric, 'al giorno da saldare in loco', true, 6
where not exists (
  select 1
  from public.extra_service_email_items
  where lower(title) = lower('Quota cane')
);
