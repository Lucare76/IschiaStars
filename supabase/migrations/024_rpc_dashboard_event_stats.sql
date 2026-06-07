-- Migration 024: aggregazione lato DB per le statistiche dashboard basate su quote_events
-- Evita di scaricare tutti gli eventi in memoria (e di subire il limite di default
-- di 1000 righe di Supabase), restituendo direttamente gli ID distinti dei
-- preventivi aperti/confermati e i click whatsapp dei clienti.

create or replace function public.get_dashboard_event_stats()
returns table (
  opened_quote_ids uuid[],
  confirmed_quote_ids uuid[],
  whatsapp_click_quote_ids uuid[]
)
language sql
stable
set search_path = public
as $$
  select
    coalesce((
      select array_agg(distinct quote_id)
      from public.quote_events
      where event_type = 'quote_opened'
    ), array[]::uuid[]) as opened_quote_ids,
    coalesce((
      select array_agg(distinct quote_id)
      from public.quote_events
      where event_type = 'quote_confirmed'
    ), array[]::uuid[]) as confirmed_quote_ids,
    coalesce((
      select array_agg(quote_id)
      from public.quote_events
      where event_type = 'whatsapp_clicked'
        and coalesce(metadata->>'placement', '') <> 'admin_quote_card'
    ), array[]::uuid[]) as whatsapp_click_quote_ids;
$$;

revoke execute on function public.get_dashboard_event_stats() from public;
revoke execute on function public.get_dashboard_event_stats() from authenticated;
grant execute on function public.get_dashboard_event_stats() to service_role;
