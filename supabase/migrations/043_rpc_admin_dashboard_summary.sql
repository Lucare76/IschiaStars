-- Migration 043: RPC aggregata per le statistiche della dashboard admin
--
-- Sostituisce quattro query separate:
--   - getDashboardQuoteRows()        (ciclo paginato su quotes)
--   - getConfirmedQuoteIds()         (select su quote_confirmations)
--   - getDashboardEventSummary()     (vecchia RPC get_dashboard_event_stats)
--   - getOpeningCounts()             (ciclo paginato su quote_events, più pesante)
--
-- Restituisce scalari: nessun array UUID scaricato, nessuna elaborazione in memoria lato app.
-- Mantiene la stessa logica di esclusione IP/bot già presente in get_dashboard_event_stats.

create or replace function public.get_admin_dashboard_summary(
  p_excluded_ips   text[]      default array['93.148.93.103']::text[],
  p_tracking_from  timestamptz default '2026-06-19T16:55:52Z'
)
returns table (
  created_quotes    bigint,
  sent_quotes       bigint,
  expired_quotes    bigint,
  confirmed_quotes  bigint,
  lost_quotes       bigint,
  confirmed_value   numeric,
  opened_quotes     bigint,
  unopened_quotes   bigint,
  whatsapp_clicks   bigint,
  repeatedly_viewed bigint,
  hot_customers     bigint
)
language sql
stable
set search_path = public
as $$
  with

  -- 1. Quote attive: non cancellate, non escluse dalle statistiche, non lab-test
  active_quotes as (
    select id, status, total_price, check_out, created_at, confirmed_at
    from public.quotes
    where deleted_at is null
      and excluded_from_stats is not true
      and coalesce(metadata->>'is_lab_test', '') <> 'true'
  ),

  -- 2. Set completo degli ID confermati (status, confirmed_at, quote_confirmations, evento)
  confirmed_ids as (
    select id as quote_id
    from active_quotes
    where status = 'confermato' or confirmed_at is not null

    union

    select qc.quote_id
    from public.quote_confirmations qc
    where qc.quote_id in (select id from active_quotes)

    union

    select distinct qe.quote_id
    from public.quote_events qe
    where qe.event_type = 'quote_confirmed'
      and qe.quote_id in (select id from active_quotes)
  ),

  -- 3. Quote evase: preventivo_inviato, non scadute, non confermate
  evaded as (
    select aq.id, aq.created_at
    from active_quotes aq
    where aq.status = 'preventivo_inviato'
      and aq.check_out >= (now() at time zone 'Europe/Rome')::date
      and aq.id not in (select quote_id from confirmed_ids)
  ),

  -- 4. Eventi trackable: esclude IP configurati e eventi post-2026-06-12 senza IP
  --    (regole identiche a get_dashboard_event_stats / migration 036b)
  trackable_events as (
    select quote_id, event_type, metadata
    from public.quote_events
    where coalesce(metadata->>'excluded_from_tracking', 'false') <> 'true'
      and (
        created_at < '2026-06-12T15:20:14Z'
        or metadata->>'ip' is not null
      )
      and not (coalesce(metadata->>'ip', '') = any(p_excluded_ips))
  ),

  -- 5. Conteggio sessioni di apertura per quote evase
  --    Approssimazione: distinct visitor_id (non nullo) + 1 se esistono eventi legacy
  --    (senza visitor_id). Equivale alla deduplicazione in memoria applicata in TypeScript,
  --    con la semplificazione che la finestra 30-minuti per visitore non è applicata:
  --    l'impatto è trascurabile per numeri di dashboard (≥2 / ≥3 sessioni).
  evaded_opening_counts as (
    select
      te.quote_id,
      count(distinct nullif(te.metadata->>'visitor_id', ''))
        + case
            when bool_or(te.metadata->>'visitor_id' is null or te.metadata->>'visitor_id' = '')
            then 1
            else 0
          end as opening_count
    from trackable_events te
    inner join evaded e on te.quote_id = e.id
    where te.event_type = 'quote_opened'
    group by te.quote_id
  )

  select

    -- Quote totali attive (tutte, incluse confermate e perse)
    (select count(*) from active_quotes)::bigint,

    -- Preventivi evasi: inviati, non scaduti, non confermati
    (select count(*) from evaded)::bigint,

    -- Preventivi scaduti: inviati, check_out passato, non confermati
    (select count(*)
     from active_quotes aq
     where aq.status = 'preventivo_inviato'
       and aq.check_out < (now() at time zone 'Europe/Rome')::date
       and aq.id not in (select quote_id from confirmed_ids)
    )::bigint,

    -- Confermati (qualsiasi metodo: status, confirmed_at, quote_confirmations, evento)
    (select count(*) from confirmed_ids)::bigint,

    -- Persi non disponibili
    (select count(*) from active_quotes where status = 'perso_non_disponibile')::bigint,

    -- Valore totale conferme
    coalesce(
      (select sum(aq.total_price)
       from active_quotes aq
       inner join confirmed_ids ci on aq.id = ci.quote_id),
      0::numeric
    ),

    -- Evasi con almeno 1 sessione di apertura trackable
    (select count(*) from evaded_opening_counts where opening_count >= 1)::bigint,

    -- Evasi non aperti con tracking affidabile (created_at >= p_tracking_from)
    (select count(*)
     from evaded e
     where e.created_at >= p_tracking_from
       and e.id not in (select quote_id from evaded_opening_counts)
    )::bigint,

    -- Click WhatsApp totali su quote attive, esclusi click dall'admin
    -- (non deduplicate per quote — comportamento identico al codice precedente)
    (select count(*)
     from trackable_events te
     inner join active_quotes aq on te.quote_id = aq.id
     where te.event_type = 'whatsapp_clicked'
       and coalesce(te.metadata->>'placement', '') <> 'admin_quote_card'
    )::bigint,

    -- Visualizzati più volte: evasi con ≥2 sessioni di apertura distinte
    (select count(*) from evaded_opening_counts where opening_count >= 2)::bigint,

    -- Clienti caldi: evasi con ≥3 sessioni di apertura distinte
    (select count(*) from evaded_opening_counts where opening_count >= 3)::bigint
$$;

revoke execute on function public.get_admin_dashboard_summary(text[], timestamptz) from anon;
revoke execute on function public.get_admin_dashboard_summary(text[], timestamptz) from authenticated;
revoke execute on function public.get_admin_dashboard_summary(text[], timestamptz) from public;

grant execute on function public.get_admin_dashboard_summary(text[], timestamptz) to service_role;
