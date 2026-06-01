alter table quote_requests
  add column if not exists processed_at timestamptz null,
  add column if not exists processed_quote_id uuid null references quotes(id);

create index if not exists quote_requests_pending_idx
  on quote_requests (status, deleted_at, processed_at);

create index if not exists quote_requests_processed_quote_id_idx
  on quote_requests (processed_quote_id);

update quote_requests request
set
  status = case when request.status = 'da_evadere' then 'preventivo_inviato' else request.status end,
  processed_at = coalesce(request.processed_at, quote.created_at),
  processed_quote_id = coalesce(request.processed_quote_id, quote.id),
  updated_at = now()
from quotes quote
where quote.quote_request_id = request.id
  and quote.deleted_at is null
  and request.deleted_at is null
  and request.processed_quote_id is null;
