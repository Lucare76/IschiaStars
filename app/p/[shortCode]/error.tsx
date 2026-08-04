"use client";

import { publicWhatsappLink } from "@/lib/utils";

export default function ShortQuoteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg font-bold text-ischia-navy">
        Non siamo riusciti a caricare correttamente il preventivo.
      </p>
      <p className="text-sm leading-6 text-ischia-ink/70">
        Riprova aggiornando la pagina oppure contattaci su WhatsApp: ti aiutiamo subito.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <button
          className="inline-flex rounded-full bg-ischia-navy px-5 py-3 text-sm font-black text-white"
          onClick={() => reset()}
          type="button"
        >
          Riprova
        </button>
        <a
          className="inline-flex rounded-full bg-ischia-leaf px-5 py-3 text-sm font-black text-white"
          href={publicWhatsappLink("Ciao, ho provato ad aprire il mio preventivo ma la pagina non si è caricata correttamente. Potete aiutarmi?")}
          rel="noopener noreferrer"
          target="_blank"
        >
          Scrivici su WhatsApp
        </a>
      </div>
    </main>
  );
}
