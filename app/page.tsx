import Link from "next/link";
import { IschiaStarsLogo } from "@/components/IschiaStarsLogo";

export default function HomePage() {
  return (
    <main className="min-h-screen px-5 py-8">
      <section className="brand-shell mx-auto flex min-h-[88vh] max-w-6xl flex-col justify-between rounded-[28px] p-6 text-white shadow-soft sm:p-10">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <IschiaStarsLogo light size={84} />
          <div className="flex gap-3 text-sm">
            <Link className="rounded-full bg-white px-4 py-2 font-semibold text-ischia-navy" href="/login">
              Accedi al backoffice
            </Link>
          </div>
        </nav>

        <div className="max-w-2xl py-14">
          <p className="mb-3 text-lg font-semibold text-ischia-sand">Hotel selezionati, offerte su misura, contatto diretto.</p>
          <h1 className="text-4xl font-bold leading-tight sm:text-6xl">Sistema Preventivi IschiaStars</h1>
          <p className="mt-5 max-w-xl text-lg text-white/86">
            Trasformiamo ogni richiesta in una proposta di viaggio chiara, veloce e su misura: dal backoffice alla conferma online del cliente.
          </p>
        </div>

        <div className="grid gap-3 text-sm text-white/88 sm:grid-cols-3">
          <span>Telefono 081 90 54 81</span>
          <span>WhatsApp 371 75 90 017</span>
          <span>Ischia, Forio, Lacco Ameno, Barano</span>
        </div>
      </section>
    </main>
  );
}
