import Link from "next/link";
import { IschiaStarsLogo } from "@/components/IschiaStarsLogo";
import { ischiastarsWhatsappNumber } from "@/lib/utils";

export function PublicQuoteLinkError() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <section className="max-w-xl rounded-[28px] bg-white p-8 text-center shadow-soft">
        <div className="flex justify-center">
          <IschiaStarsLogo />
        </div>
        <h1 className="mt-8 text-3xl font-black text-ischia-navy">Preventivo non disponibile</h1>
        <p className="mt-3 text-ischia-ink/70">
          Non siamo riusciti ad aprire il preventivo. Il link potrebbe essere incompleto o non più valido. Contattaci su WhatsApp per riceverlo di nuovo.
        </p>
        <Link className="mt-6 inline-flex rounded-full bg-ischia-leaf px-5 py-3 font-black text-white" href={`https://wa.me/${ischiastarsWhatsappNumber()}`}>
          Scrivi su WhatsApp
        </Link>
      </section>
    </main>
  );
}
