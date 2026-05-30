alter table public.hotels add column if not exists external_image_url text;
alter table public.hotels add column if not exists sync_metadata jsonb not null default '{}';
