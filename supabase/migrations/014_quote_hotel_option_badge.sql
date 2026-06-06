alter table public.quote_hotel_options
  add column if not exists badge text default null;
