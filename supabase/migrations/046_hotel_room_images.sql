-- Store reusable room photos on the hotel record.
-- Each item is expected to be: { "label": "...", "imageUrl": "https://..." }.

alter table public.hotels
  add column if not exists room_images jsonb not null default '[]'::jsonb;

comment on column public.hotels.room_images is
  'Reusable room image presets for quotes. JSON array of {label,imageUrl}.';
