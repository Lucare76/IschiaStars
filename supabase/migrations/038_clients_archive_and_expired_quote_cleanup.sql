-- Conserva l'anagrafica cliente indipendentemente dai preventivi e consente
-- una pulizia esplicita dei soggiorni passati senza perdere i contatti.

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  phone text not null default '',
  normalized_email text generated always as (lower(trim(email))) stored,
  normalized_phone text generated always as (regexp_replace(phone, '[^0-9]+', '', 'g')) stored,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (normalized_email <> '' or normalized_phone <> '')
);

create unique index if not exists clients_normalized_email_uidx
  on public.clients (normalized_email)
  where normalized_email <> '';

create unique index if not exists clients_normalized_phone_uidx
  on public.clients (normalized_phone)
  where normalized_email = '' and normalized_phone <> '';

alter table public.clients enable row level security;

drop policy if exists "operators manage clients" on public.clients;
create policy "operators manage clients" on public.clients
  for all to authenticated
  using ((auth.jwt() ->> 'email') in ('info@ischiastars.it', 'luca_renna@hotmail.com'))
  with check ((auth.jwt() ->> 'email') in ('info@ischiastars.it', 'luca_renna@hotmail.com'));

grant select, insert, update, delete on public.clients to authenticated, service_role;

create or replace function public.upsert_client_contact(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_seen_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]+', '', 'g');
begin
  if v_email = '' and v_phone = '' then
    return;
  end if;

  if v_email <> '' then
    insert into public.clients (first_name, last_name, email, phone, first_seen_at, last_seen_at)
    values (
      coalesce(p_first_name, ''),
      coalesce(p_last_name, ''),
      coalesce(p_email, ''),
      coalesce(p_phone, ''),
      p_seen_at,
      p_seen_at
    )
    on conflict (normalized_email) where normalized_email <> ''
    do update set
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      email = excluded.email,
      phone = case when excluded.phone <> '' then excluded.phone else clients.phone end,
      last_seen_at = greatest(clients.last_seen_at, excluded.last_seen_at),
      updated_at = now();
  else
    insert into public.clients (first_name, last_name, email, phone, first_seen_at, last_seen_at)
    values (
      coalesce(p_first_name, ''),
      coalesce(p_last_name, ''),
      '',
      coalesce(p_phone, ''),
      p_seen_at,
      p_seen_at
    )
    on conflict (normalized_phone) where normalized_email = '' and normalized_phone <> ''
    do update set
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      phone = excluded.phone,
      last_seen_at = greatest(clients.last_seen_at, excluded.last_seen_at),
      updated_at = now();
  end if;
end;
$$;

create or replace function public.sync_quote_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.upsert_client_contact(
    new.client_first_name,
    new.client_last_name,
    new.client_email,
    new.client_phone,
    coalesce(new.created_at, now())
  );
  return new;
end;
$$;

drop trigger if exists quotes_sync_client on public.quotes;
create trigger quotes_sync_client
after insert or update of client_first_name, client_last_name, client_email, client_phone
on public.quotes
for each row execute function public.sync_quote_client();

insert into public.clients (first_name, last_name, email, phone, first_seen_at, last_seen_at)
select distinct on (
  case
    when trim(coalesce(client_email, '')) <> '' then lower(trim(client_email))
    else regexp_replace(coalesce(client_phone, ''), '[^0-9]+', '', 'g')
  end
)
  client_first_name,
  client_last_name,
  client_email,
  client_phone,
  created_at,
  created_at
from public.quotes
where trim(coalesce(client_email, '')) <> ''
   or regexp_replace(coalesce(client_phone, ''), '[^0-9]+', '', 'g') <> ''
order by
  case
    when trim(coalesce(client_email, '')) <> '' then lower(trim(client_email))
    else regexp_replace(coalesce(client_phone, ''), '[^0-9]+', '', 'g')
  end,
  created_at desc
on conflict do nothing;

-- Non viene eseguita automaticamente. Va richiamata solo dopo avere scelto
-- una data limite. Per sicurezza esclude le prenotazioni confermate.
create or replace function public.delete_expired_unconfirmed_quotes(
  p_departure_before date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if p_departure_before is null or p_departure_before >= current_date then
    raise exception 'La data limite deve essere precedente a oggi';
  end if;

  delete from public.quotes
  where check_out < p_departure_before
    and status <> 'confermato'
    and not exists (
      select 1
      from public.quote_confirmations qc
      where qc.quote_id = quotes.id
    );

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.delete_expired_unconfirmed_quotes(date) from public;
revoke execute on function public.delete_expired_unconfirmed_quotes(date) from authenticated;
grant execute on function public.delete_expired_unconfirmed_quotes(date) to service_role;
