-- Add declared age to children tables (request and quote phase).
-- birth_date becomes optional: collected only at confirmation, not at request time.
alter table public.quote_request_children
  alter column birth_date drop not null,
  add column if not exists age integer check (age >= 0 and age <= 17);

alter table public.quote_children
  alter column birth_date drop not null,
  add column if not exists age integer check (age >= 0 and age <= 17);
