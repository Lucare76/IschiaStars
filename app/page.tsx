import { redirect } from "next/navigation";
import { IschiaStarsLogo } from "@/components/IschiaStarsLogo";
import { LoginForm } from "@/components/LoginForm";
import { getAdminSession } from "@/lib/server/auth-guard";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const emotionalCopy =
  "Trasformiamo ogni richiesta in una proposta di viaggio chiara, veloce e su misura: dal backoffice alla conferma online del cliente.";

export default async function HomePage() {
  const session = await getAdminSession();
  if (session) redirect("/admin");

  const configured = isSupabaseConfigured();

  return (
    <main className="min-h-screen px-5 py-8">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="brand-shell hidden min-h-[620px] rounded-[28px] p-8 text-white shadow-soft lg:flex lg:flex-col lg:justify-between">
          <IschiaStarsLogo light size={92} />
          <div>
            <p className="mb-3 text-lg font-semibold text-ischia-sand">Hotel selezionati, offerte su misura, contatto diretto.</p>
            <h1 className="max-w-xl text-5xl font-black leading-tight">Sistema Preventivi IschiaStars</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/86">{emotionalCopy}</p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md rounded-[28px] bg-white/92 p-6 shadow-soft ring-1 ring-ischia-blue/10 sm:p-8">
          <IschiaStarsLogo size={82} />
          <div className="mt-8">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-ischia-blue">Area riservata</p>
            <h2 className="mt-1 text-3xl font-black text-ischia-navy">Accesso backoffice</h2>
            <p className="mt-2 text-sm leading-6 text-ischia-ink/72">Inserisci le credenziali operatore per gestire richieste, preventivi e strutture.</p>
            <p className="mt-4 text-sm leading-6 text-ischia-ink/72 lg:hidden">{emotionalCopy}</p>
          </div>
          {!configured ? (
            <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800 ring-1 ring-amber-100">
              Accesso temporaneamente non disponibile. Contatta il referente tecnico.
            </p>
          ) : (
            <LoginForm />
          )}
        </div>
      </section>
    </main>
  );
}
