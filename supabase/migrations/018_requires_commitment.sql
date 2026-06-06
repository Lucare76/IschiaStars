-- Migration 018: aggiunge il campo requires_commitment alla tabella quotes.
-- Consente a Diego di segnare un preventivo come soggetto a obbligo di impegnativa
-- e mostrare un avviso visibile al cliente nel preventivo.

alter table public.quotes
  add column requires_commitment boolean not null default false;
