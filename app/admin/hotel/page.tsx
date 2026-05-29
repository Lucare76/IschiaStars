import { AdminShell } from "@/components/AdminShell";
import { HotelManager } from "@/components/HotelManager";
import { listHotels } from "@/lib/repositories/hotels";

export const dynamic = "force-dynamic";

export default async function HotelsPage() {
  const hotelResult = await listHotels();
  const hotels = hotelResult.data;

  return (
    <AdminShell title="Hotel / strutture" subtitle="Anagrafica strutture con servizi e policy standard da usare nella creazione preventivo.">
      <HotelManager initialHotels={hotels} />
    </AdminShell>
  );
}
