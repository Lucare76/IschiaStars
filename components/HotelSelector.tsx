"use client";

import { useState } from "react";
import { hotels as mockHotels } from "@/lib/mock-data";
import { Hotel } from "@/lib/types";

export function HotelSelector({ hotels = mockHotels }: { hotels?: Hotel[] }) {
  const [hotelId, setHotelId] = useState(hotels[0]?.id ?? "");
  const selected = hotels.find((hotel) => hotel.id === hotelId) ?? hotels[0];

  if (!selected) {
    return <div className="rounded-2xl bg-white/90 p-5 shadow-soft">Nessun hotel configurato</div>;
  }

  return (
    <div className="rounded-2xl bg-white/90 p-5 shadow-soft">
      <label className="text-sm font-bold uppercase tracking-[0.14em] text-ischia-blue" htmlFor="hotel">
        Hotel proposto
      </label>
      <select id="hotel" className="focus-ring mt-2 w-full rounded-xl border border-ischia-blue/20 bg-white px-4 py-3 font-semibold text-ischia-navy" value={hotelId} onChange={(event) => setHotelId(event.target.value)}>
        {hotels.map((hotel) => (
          <option key={hotel.id} value={hotel.id}>
            {hotel.name} - {hotel.zone}
          </option>
        ))}
      </select>
      <div className="mt-4 rounded-xl bg-ischia-mist p-4 text-sm">
        <p className="font-bold text-ischia-navy">{selected.name}</p>
        <p className="mt-1 text-ischia-ink/72">{selected.description}</p>
      </div>
    </div>
  );
}
