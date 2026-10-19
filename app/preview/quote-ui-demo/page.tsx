import { notFound } from "next/navigation";
import { PublicQuotePage } from "@/components/PublicQuotePage";
import type { PublicQuoteDTO } from "@/lib/public-quote-dto";
import type { FeatureFlags } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

const demoQuote: PublicQuoteDTO = {
  id: "preview-demo-4242",
  code: "IS-2026-4242",
  token: "preview-demo-token",
  customerFirstName: "Leontina",
  customerLastName: "La rocca",
  customerEmail: "preview@example.com",
  customerPhone: "0000000000",
  requestedHotel: "",
  isAlternative: false,
  arrivalDate: "2026-12-30",
  departureDate: "2027-01-02",
  adults: 4,
  children: [],
  rooms: 1,
  offerExpiresAt: "2026-10-22",
  customerNotes: "OFFERTA PRENOTA PRIMA\nUltime disponibilità con queste tariffe\nBevande incluse ( acqua e vino )\nCenone di San Silvestro incluso",
  status: "preventivo_inviato",
  hasConfirmation: false,
  hotelOptions: [
    {
      id: "demo-castiglione",
      hotelGroup: 1,
      badge: null,
      hotelReason: "Ottimo rapporto qualità/prezzo, Consigliato per coppie, Uno dei più richiesti della stagione, Ideale per famiglie con bambini",
      roomTypeLabel: "Camera quadrupla standard",
      hotelName: "Hotel Terme Castiglione Village",
      hotelLocation: "Ischia",
      hotelStars: 3,
      hotelImageUrl: "https://ischiastars.it/wp-content/uploads/2026/03/Castiglione-Village-1.jpeg",
      sourceUrl: "https://ischiastars.it/hotel/hotel-castiglione-village-spa/",
      halfBoardDetails: "Bevande incluse ( acqua e vino ), Cenone di San Silvestro incluso, Accesso spa/terme incluso, Parcheggio incluso",
      fullBoardDetails: "Bevande incluse ( acqua e vino ), Cenone di San Silvestro incluso, Accesso spa/terme incluso, Parcheggio incluso",
      includedServices: "Wi-Fi\nParcheggio\nPiscina\nRistorante\nSpa\nPalestra\nAria condizionata\nColazione inclusa",
      depositPercent: 22.73,
      balanceMethod: "Saldo restante in struttura con carta o contanti.",
      paymentPolicy: "Acconto alla conferma. Saldo restante in struttura.",
      cancellationPolicy: "Cancellazione secondo le condizioni della struttura.",
      notes: "Cenone di San Silvestro incluso",
      commitmentNote: null,
      isSelected: false,
      treatments: [
        { key: "half_board", label: "Mezza pensione", price: 867 },
        { key: "full_board", label: "Pensione completa", price: 1047 }
      ]
    },
    {
      id: "demo-tramonto",
      hotelGroup: 2,
      badge: null,
      hotelReason: "Ottimo rapporto qualità/prezzo, Consigliato per coppie, Uno dei più richiesti della stagione",
      roomTypeLabel: "Camera quadrupla standard",
      hotelName: "Hotel Terme Tramonto d’Oro",
      hotelLocation: "Ischia",
      hotelStars: 4,
      hotelImageUrl: "https://ischiastars.it/wp-content/uploads/2026/03/hotel-terme-tramontodoro-ischia-piscina2small.jpg",
      sourceUrl: "https://ischiastars.it/hotel/hotel-tramonto-doro/",
      fullBoardDetails: "Bevande incluse ( acqua e vino ), Cenone di San Silvestro incluso, Accesso spa/terme incluso",
      includedServices: "Wi-Fi\nParcheggio\nPiscina\nRistorante\nSpa\nAria condizionata\nColazione inclusa\nAnimali ammessi",
      depositPercent: 25,
      balanceMethod: "Saldo restante in struttura con carta o contanti.",
      paymentPolicy: "Acconto 25% alla conferma. Saldo restante in struttura.",
      cancellationPolicy: "Cancellazione secondo le condizioni della struttura.",
      notes: "Cenone di San Silvestro incluso",
      commitmentNote: null,
      isSelected: false,
      treatments: [
        { key: "full_board", label: "Pensione completa", price: 1197 }
      ]
    }
  ]
};

const demoFlags: FeatureFlags = {
  wow6_adaptive: false,
  instant_reaction: true,
  alternative_proposal: false,
  voucher_cliente: false,
  supplier_confirmation: false,
  emailTravelServicesBox: false
};

export default function QuoteUiPreviewDemoPage() {
  const isPreview = process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development";
  if (!isPreview) notFound();

  return (
    <div className="[&_a]:pointer-events-none [&_button]:pointer-events-none">
      <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          Demo grafica Preview — dati fittizi, tracking e azioni disabilitati.
        </div>
      </div>
      <PublicQuotePage
        quote={demoQuote}
        hotelPopularity={{
          "Hotel Terme Castiglione Village": 61,
          "Hotel Terme Tramonto d’Oro": 10
        }}
        featureFlags={demoFlags}
        trackOpening={false}
      />
    </div>
  );
}
