alter table public.quote_hotel_options
  add column requires_commitment boolean not null default false;
