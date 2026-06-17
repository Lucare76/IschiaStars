import { IschiaStarsLogo } from "@/components/IschiaStarsLogo";

export default function QuoteLoading() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <section className="max-w-xl rounded-[28px] bg-white p-8 text-center shadow-soft">
        <div className="flex justify-center">
          <IschiaStarsLogo />
        </div>
        <p className="mt-8 text-lg font-bold text-ischia-navy">Caricamento del preventivo…</p>
        <div className="mt-4 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-ischia-blue/20 border-t-ischia-blue" />
        </div>
      </section>
    </main>
  );
}
