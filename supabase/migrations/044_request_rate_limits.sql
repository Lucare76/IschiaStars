-- Migration 044: rate limit leggero per route pubbliche
--
-- Protegge il form pubblico da spam/invii ripetuti senza salvare IP in chiaro.
-- La route server salva solo ip_hash = sha256(IP + RATE_LIMIT_SECRET).

create table if not exists public.request_rate_limits (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  route text not null,
  window_start timestamptz not null,
  request_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint request_rate_limits_count_positive check (request_count > 0)
);

create unique index if not exists request_rate_limits_route_ip_window_uidx
  on public.request_rate_limits(route, ip_hash, window_start);

alter table public.request_rate_limits enable row level security;

revoke all on public.request_rate_limits from anon;
revoke all on public.request_rate_limits from authenticated;
revoke all on public.request_rate_limits from public;
grant select, insert, update, delete on public.request_rate_limits to service_role;

create or replace function public.check_request_rate_limit(
  p_route text,
  p_ip_hash text,
  p_limit integer default 3,
  p_window_minutes integer default 15
)
returns table (
  allowed boolean,
  remaining integer,
  request_count integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_route text := nullif(trim(p_route), '');
  v_ip_hash text := nullif(trim(p_ip_hash), '');
  v_limit integer := greatest(coalesce(p_limit, 3), 1);
  v_window_minutes integer := greatest(coalesce(p_window_minutes, 15), 1);
  v_window_seconds integer;
  v_window_start timestamptz;
  v_count integer;
begin
  if v_route is null or v_ip_hash is null then
    allowed := true;
    remaining := v_limit;
    request_count := 0;
    reset_at := now();
    return next;
    return;
  end if;

  v_window_seconds := v_window_minutes * 60;
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / v_window_seconds) * v_window_seconds
  );

  insert into public.request_rate_limits (route, ip_hash, window_start, request_count)
  values (v_route, v_ip_hash, v_window_start, 1)
  on conflict (route, ip_hash, window_start)
  do update set
    request_count = public.request_rate_limits.request_count + 1,
    updated_at = now()
  returning public.request_rate_limits.request_count into v_count;

  allowed := v_count <= v_limit;
  remaining := greatest(v_limit - v_count, 0);
  request_count := v_count;
  reset_at := v_window_start + make_interval(mins => v_window_minutes);
  return next;
end;
$$;

revoke execute on function public.check_request_rate_limit(text, text, integer, integer) from anon;
revoke execute on function public.check_request_rate_limit(text, text, integer, integer) from authenticated;
revoke execute on function public.check_request_rate_limit(text, text, integer, integer) from public;

grant execute on function public.check_request_rate_limit(text, text, integer, integer) to service_role;
