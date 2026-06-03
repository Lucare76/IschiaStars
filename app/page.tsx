import Link from "next/link";
import { IschiaStarsLogo } from "@/components/IschiaStarsLogo";

export default function HomePage() {
  return (
    <main className="min-h-screen px-3 py-4 sm:px-5 sm:py-8">
      <section className="brand-shell mx-auto flex min-h-[calc(100svh-2rem)] max-w-6xl flex-col justify-between rounded-[22px] p-5 text-white shadow-soft sm:min-h-[88vh] sm:rounded-[28px] sm:p-10">
        <nav className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <IschiaStarsLogo light size={84} />
          <div className="flex w-full gap-3 text-sm sm:w-auto">
            <Link className="w-full rounded-full bg-white px-4 py-3 text-center font-semibold text-ischia-navy sm:w-auto sm:py-2" href="/login">
              Accedi al backoffice
            </Link>
          </div>
        </nav>

        <div className="max-w-2xl py-10 sm:py-14">
          <p className="mb-3 text-base font-semibold text-ischia-sand sm:text-lg">Hotel selezionati, offerte su misura, contatto diretto.</p>
          <h1 className="text-3xl font-bold leading-tight sm:text-6xl">Sistema Preventivi IschiaStars</h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/86 sm:text-lg">
            Trasformiamo ogni richiesta in una proposta di viaggio chiara, veloce e su misura: dal backoffice alla conferma online del cliente.
          </p>
        </div>

        <div className="grid gap-2 text-sm text-white/88 sm:grid-cols-3 sm:gap-3">
          <span>Telefono 081 90 54 81</span>
          <span>WhatsApp 371 75 90 017</span>
          <span>Ischia, Forio, Lacco Ameno, Barano</span>
        </div>
      </section>
    </main>
  );
}
