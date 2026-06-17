-- Exclude ghost events (null IP) from dashboard stats.
-- These are bot/crawler requests that bypass normal browser headers.

create or replace function public.get_dashboard_event_stats(
  p_excluded_ips text[] default array['93.148.93.103']::text[]
)
returns table (
  opened_quote_ids uuid[],
  confirmed_quote_ids uuid[],
  whatsapp_click_quote_ids uuid[]
)
language sql
stable
set search_path = public
as $$
  with trackable_events as (
    select *
    from public.quote_events
    where coalesce(metadata->>'excluded_from_tracking', 'false') <> 'true'
      and metadata->>'ip' is not null
      and not (coalesce(metadata->>'ip', '') = any(p_excluded_ips))
  )
  select
    coalesce((
      select array_agg(distinct quote_id)
      from trackable_events
      where event_type = 'quote_opened'
    ), array[]::uuid[]) as opened_quote_ids,
    coalesce((
      select array_agg(distinct quote_id)
      from trackable_events
      where event_type = 'quote_confirmed'
    ), array[]::uuid[]) as confirmed_quote_ids,
    coalesce((
      select array_agg(quote_id)
      from trackable_events
      where event_type = 'whatsapp_clicked'
        and coalesce(metadata->>'placement', '') <> 'admin_quote_card'
    ), array[]::uuid[]) as whatsapp_click_quote_ids;
$$;
