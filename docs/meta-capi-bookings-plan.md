# Meta Conversions API — prenotazioni confermate (bozza)

## Stato
Questa PR contiene soltanto un generatore di payload disattivato. Nessun evento viene inviato e nessuna rotta del gestionale è stata modificata.

## Verifiche effettuate nel codice
- La rotta `app/api/quote-confirmations/[id]/deposit-received/route.ts` registra caparra o pagamento totale.
- La rotta `balance-received` registra il saldo: non deve generare un secondo acquisto.
- La rotta `manual-confirmation` permette inserimenti manuali con `acceptedPrivacy: false`: non attribuire automaticamente questi clienti al sito.
- `markDepositPaid` può restituire una conferma già pagata; quindi il semplice successo della chiamata non dimostra che il pagamento sia nuovo. Serve un outbox con vincolo univoco.

## Prima di collegare l'evento alla rotta
1. Verificare il consenso specifico per finalità pubblicitarie/trasmissione dati a Meta e il relativo registro; `acceptedPrivacy` non equivale automaticamente al consenso marketing.
2. Collegare richiesta originale, preventivo e conferma; salvare origine verificata e, quando disponibili e consentiti, `_fbp`, `_fbc` e parametri di attribuzione in modo sicuro. Non dedurre la provenienza Meta da campi vuoti.
3. Implementare outbox persistente (chiave univoca per confirmation_id + event_name), stato pending/sent/error, retry e log minimizzati. Nessuna perdita di prenotazione se Meta non risponde.
4. Decidere con il titolare se `Purchase` rappresenta il valore totale del soggiorno oppure il solo incasso della caparra; usare una definizione coerente.
5. Configurare su Vercel solo variabili server-side `META_CAPI_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN` e flag `META_BOOKING_CAPI_ENABLED` (default disattivato). Non inserire token nel repository.
6. Verificare dataset/Pixel e gli eventi browser esistenti in Gestione eventi, deduplicando via `event_name` + `event_id` se presente lo stesso evento lato browser.
7. Eseguire test con eventi sintetici e test code in Meta, senza inviare dati di clienti reali; poi controllare diagnosi ed eventuali errori.

## Regola di attivazione
Non fare merge o deploy fino a revisione del flusso, privacy e test. Il ramo non cambia la campagna Ads attiva.
