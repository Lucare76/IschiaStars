-- Link pubblici brevi e stabili per condivisione WhatsApp.
alter table public.quotes
  add column if not exists public_short_code text;

update public.quotes
set public_short_code = encode(gen_random_bytes(8), 'hex')
where public_short_code is null or public_short_code = '';

alter table public.quotes
  alter column public_short_code set default encode(gen_random_bytes(8), 'hex'),
  alter column public_short_code set not null;

create unique index if not exists quotes_public_short_code_key
  on public.quotes (public_short_code);

alter table public.quotes
  drop constraint if exists quotes_public_short_code_format;

alter table public.quotes
  add constraint quotes_public_short_code_format
  check (public_short_code ~ '^[0-9a-f]{16}$');
