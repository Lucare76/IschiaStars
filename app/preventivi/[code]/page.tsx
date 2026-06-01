import Link from "next/link";
import type { Metadata } from "next";
import { IschiaStarsLogo } from "@/components/IschiaStarsLogo";
import { PublicQuotePage } from "@/components/PublicQuotePage";
import { getQuoteByCodeAndToken } from "@/lib/repositories/quotes";
import { ischiastarsWhatsappNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
};

export default async function QuotePublicRoute({ params, searchParams }: { params: { code: string }; searchParams: { token?: string } }) {
  const result = await getQuoteByCodeAndToken(params.code, searchParams.token);
  const quote = result.data;
  if (!quote || quote.deletedAt) return <InvalidQuotePage />;
  return <PublicQuotePage quote={quote} />;
}

function InvalidQuotePage() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <section className="max-w-xl rounded-[28px] bg-white p-8 text-center shadow-soft">
        <div className="flex justify-center">
          <IschiaStarsLogo />
        </div>
        <h1 className="mt-8 text-3xl font-black text-ischia-navy">Preventivo non disponibile o link non valido</h1>
        <p className="mt-3 text-ischia-ink/70">Controlla il link ricevuto oppure scrivi a IschiaStars su WhatsApp per ricevere di nuovo la tua proposta.</p>
        <Link className="mt-6 inline-flex rounded-full bg-ischia-leaf px-5 py-3 font-black text-white" href={`https://wa.me/${ischiastarsWhatsappNumber()}`}>
          Scrivi su WhatsApp
        </Link>
      </section>
    </main>
  );
}
