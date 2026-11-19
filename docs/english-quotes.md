# Preventivi in inglese

- Nella creazione, **Lingua cliente** parte da English se la richiesta importata ha `language=en` oppure proviene da un URL `/en/`. La lingua si può scegliere manualmente.
- Dopo il salvataggio, **Lingua cliente e versione inglese** permette di completare e modificare le traduzioni per quel preventivo. Le formule standard sono precompilate. I testi liberi richiedono una traduzione dell'operatore: non è collegato un servizio esterno di traduzione automatica.
- Salvare lingua e traduzioni prima di inviare email o WhatsApp. Gli originali italiani rimangono intatti. Se un testo originale cambia, la sua vecchia traduzione non viene riutilizzata.
- Pagina cliente, richiesta di prenotazione, email al cliente (compresi follow-up e saldo), WhatsApp e voucher automatico seguono la lingua salvata. Le comunicazioni operative interne e ai fornitori restano in italiano.
- Il modulo inglese richiede il Paese e ammette codici postali esteri; codice fiscale italiano e provincia sono facoltativi. Prezzi e condizioni vengono risolti sul server a partire dagli ID della selezione originale.
- Per WhatsApp estero serve il prefisso internazionale, ad esempio `+44`, senza aggiunta automatica del prefisso italiano.
- Per note successive alla prima traduzione (es. note conferma o voucher), preparare la coppia originale/inglese con **Prepara una nota aggiuntiva in inglese**, poi salvare.
- Nei voucher manuali selezionare English e scrivere i contenuti liberi direttamente in inglese. Non viene tradotto automaticamente il testo scritto a mano.

## Database

La migrazione `20261119125216_quote_localization_metadata.sql` aggiunge due funzioni con privilegi limitati a `service_role`. I dati sono nei campi `language` ed `english_translations` del JSON metadata esistente; gli altri metadati vengono mantenuti. La creazione inglese e il salvataggio della lingua avvengono nella stessa transazione.

## Verifica

```
TSX_TSCONFIG_PATH=tests/tsconfig.json node --import tsx tests/english-quotes.test.ts
npx tsc --noEmit
npm run build
```

Il test non invia email e genera un voucher fittizio in `tmp/pdfs`. Verifica rilevamento lingua, traduzioni mancanti o obsolete, numeri esteri, pagina e form inglesi, tutti i messaggi cliente e servizi extra nel PDF.
