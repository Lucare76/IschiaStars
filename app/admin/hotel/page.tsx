import { AdminShell } from "@/components/AdminShell";
import { HotelManager } from "@/components/HotelManager";
import { listHotels } from "@/lib/repositories/hotels";

export const dynamic = "force-dynamic";

export default async function HotelsPage() {
  const hotelResult = await listHotels();
  const hotels = hotelResult.data;

  return (
    <AdminShell title="Hotel / strutture" subtitle="Anagrafica strutture con servizi e policy standard da usare nella creazione preventivo.">
      {hotelResult.source === "supabase" ? <HotelManager initialHotels={hotels} /> : <DataUnavailable error={hotelResult.error} />}
    </AdminShell>
  );
}

function DataUnavailable({ error }: { error?: string }) {
  return (
    <div className="rounded-2xl bg-red-50 p-5 text-sm font-semibold text-red-800 shadow-soft ring-1 ring-red-200">
      <p className="text-base font-black">Hotel non disponibili</p>
      <p className="mt-2">Impossibile caricare i dati in questo momento. Riprova tra qualche minuto.</p>
      {error ? <p className="mt-3 break-words text-xs text-red-700/80">Dettaglio tecnico: {error}</p> : null}
    </div>
  );
}
