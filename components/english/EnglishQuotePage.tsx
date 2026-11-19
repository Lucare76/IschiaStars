"use client";
import { useRef, useState } from "react";
import type {
  PublicQuoteDTO,
  PublicQuoteHotelOptionDTO,
} from "@/lib/public-quote-dto";
import type { QuoteRoomSelection, TreatmentOption } from "@/lib/types";
import { englishDate, englishMoney } from "@/lib/i18n/quote-language";
import { publicWhatsappLink } from "@/lib/utils";
import { PublicEventTracker } from "@/components/PublicEventTracker";

export function EnglishQuotePage({
  quote,
  trackOpening = true,
  openingSource,
}: {
  quote: PublicQuoteDTO;
  trackOpening?: boolean;
  openingSource?: string;
}) {
  const [selected, setSelected] = useState<QuoteRoomSelection[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const confirmed = quote.hasConfirmation;
  const whatsapp = publicWhatsappLink(
    `Hello, I have a question about my Ischia holiday offer ${quote.code}.`,
  );
  const total = selected.reduce((sum, room) => sum + room.price, 0);
  const deposit = selected.reduce(
    (sum, room) => sum + (room.depositAmount ?? 0),
    0,
  );
  const complete = selected.length === quote.rooms;
  const expired =
    quote.offerExpiresAt <
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  function choose(
    option: PublicQuoteHotelOptionDTO,
    treatment: TreatmentOption,
  ) {
    if (complete) return;
    if (selected.length && selected[0].hotelGroup !== option.hotelGroup) {
      setError(
        "Please choose rooms within the same hotel proposal, or clear your selection first.",
      );
      return;
    }
    const amount =
      Math.round(treatment.price * (option.depositPercent ?? 0)) / 100;
    const next = [
      ...selected,
      {
        optionId: option.id,
        hotelGroup: option.hotelGroup,
        hotelName: option.hotelName,
        roomTypeLabel: option.roomTypeLabel,
        treatmentKey: treatment.key,
        treatmentLabel: treatment.label,
        price: treatment.price,
        depositAmount: amount,
        cancellationPolicy: option.cancellationPolicy,
        balanceMethod: option.balanceMethod,
      },
    ];
    setSelected(next);
    setError("");
    if (next.length === quote.rooms)
      requestAnimationFrame(() => {
        heading.current?.focus({ preventScroll: true });
        heading.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !complete) return;
    setBusy(true);
    setError("");
    const values = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/quote-confirmations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteCode: quote.code,
          token: quote.token,
          ...Object.fromEntries(
            [
              "firstName",
              "lastName",
              "phone",
              "email",
              "fiscalCode",
              "address",
              "city",
              "postalCode",
              "province",
              "country",
            ].map((key) => [key, String(values.get(key) ?? "")]),
          ),
          acceptedTerms: values.get("acceptedTerms") === "on",
          acceptedPrivacy: values.get("acceptedPrivacy") === "on",
          selectedRooms: selected.map((room) => ({
            optionId: room.optionId,
            treatmentKey: room.treatmentKey,
          })),
          children: quote.children.map((child) => ({
            id: child.id,
            birthDate: String(values.get(`child-${child.id}`) ?? ""),
          })),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok)
        throw Error(
          payload?.error ??
            "We could not save your request. Please contact us on WhatsApp.",
        );
      setDone(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Please contact us on WhatsApp.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!quote.englishReady)
    return (
      <main lang="en" className="mx-auto max-w-2xl p-8">
        <h1 className="text-3xl font-black text-ischia-navy">
          Your Ischia holiday offer
        </h1>
        <p className="my-5">
          We are preparing the English version of your personalised offer.
          Please contact us for details.
        </p>
        <a className="font-bold underline" href={whatsapp}>
          Contact IschiaStars on WhatsApp
        </a>
      </main>
    );
  return (
    <main
      lang="en"
      className="print-page mx-auto max-w-5xl space-y-5 px-4 py-5 pb-12 text-ischia-navy"
    >
      {trackOpening && (
        <PublicEventTracker
          quoteCode={quote.code}
          token={quote.token}
          source={openingSource}
        />
      )}
      <header className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-soft">
        <a href="https://ischiastars.it/en/" className="font-black">
          ISCHIA STARS
        </a>
        <div className="flex gap-2">
          <a
            href={whatsapp}
            className="rounded-full bg-ischia-leaf px-4 py-2 text-sm font-bold text-white"
          >
            WhatsApp
          </a>
          <button
            type="button"
            className="rounded-full bg-ischia-navy px-4 py-2 text-sm font-bold text-white"
            onClick={() => window.print()}
          >
            Print / Save PDF
          </button>
        </div>
      </header>
      <section className="rounded-3xl bg-white p-6 shadow-soft">
        <p className="text-xs font-bold tracking-widest">
          HOLIDAY OFFER {quote.code}
        </p>
        <h1 className="mt-3 text-3xl font-black sm:text-4xl">
          Your personalised holiday in Ischia
        </h1>
        <p className="mt-3">
          Hello {quote.customerFirstName}, discover the options we have selected
          for your stay.
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-4 rounded-2xl bg-ischia-mist p-4 text-sm">
          <div>
            <dt>Dates</dt>
            <dd className="font-bold">
              {englishDate(quote.arrivalDate)} –{" "}
              {englishDate(quote.departureDate)}
            </dd>
          </div>
          <div>
            <dt>Guests</dt>
            <dd className="font-bold">
              {quote.adults} adults
              {quote.children.length
                ? `, ${quote.children.length} children`
                : ""}{" "}
              · {quote.rooms} {quote.rooms === 1 ? "room" : "rooms"}
            </dd>
          </div>
        </dl>
        {quote.customerNotes && (
          <p className="mt-4 whitespace-pre-line text-sm leading-6">
            {quote.customerNotes}
          </p>
        )}
        {!confirmed && (
          <p className="mt-4 text-sm font-bold">
            {expired
              ? "This offer has expired. We will check current availability, prices and conditions before confirming your booking."
              : `OFFER VALID UNTIL: ${englishDate(quote.offerExpiresAt)}`}
          </p>
        )}
      </section>
      {quote.costBreakdown && (
        <section className="rounded-2xl bg-white p-5 shadow-soft">
          <h2 className="font-black">Selected proposal: cost breakdown</h2>
          <div className="mt-3 flex justify-between gap-3">
            <span>
              {quote.costBreakdown.hasUnpricedServices
                ? "Accommodation and services without a separate price"
                : "Hotel accommodation"}
            </span>
            <strong>{englishMoney(quote.costBreakdown.accommodation)}</strong>
          </div>
          {quote.costBreakdown.services.map((service, index) => (
            <div key={index} className="mt-2 flex justify-between gap-3">
              <span>{service.label}</span>
              <strong>
                {service.cost != null
                  ? englishMoney(service.cost)
                  : "Price not specified"}
              </strong>
            </div>
          ))}
          <div className="mt-4 flex justify-between border-t pt-3 font-black">
            <span>Grand total</span>
            <span>{englishMoney(quote.costBreakdown.total)}</span>
          </div>
        </section>
      )}
      <h2 className="text-2xl font-black">Your hotel proposals</h2>
      {quote.hotelOptions.map((option) => (
        <section
          key={option.id}
          className="overflow-hidden rounded-3xl bg-white shadow-soft"
        >
          <div className="p-5">
            <h3 className="text-2xl font-black">{option.hotelName}</h3>
            <p className="mt-1">
              {option.hotelLocation}{" "}
              {option.hotelStars ? "★".repeat(option.hotelStars) : ""}
            </p>
            {option.hotelReason && <p className="mt-3">{option.hotelReason}</p>}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {option.treatments.map((treatment) => (
                <div
                  key={treatment.key}
                  className="rounded-2xl bg-ischia-mist p-4"
                >
                  <h4 className="font-black">{treatment.label}</h4>
                  <p className="text-sm">{option.roomTypeLabel}</p>
                  <p className="mt-2 text-3xl font-black">
                    {englishMoney(treatment.price)}
                  </p>
                  <p className="text-xs">
                    Total for {quote.rooms > 1 ? "this room" : "your stay"}
                  </p>
                  {!confirmed && !done && (
                    <button
                      type="button"
                      disabled={complete}
                      onClick={() => choose(option, treatment)}
                      className="no-print mt-3 w-full rounded-full bg-ischia-sun px-4 py-3 text-sm font-black disabled:opacity-50"
                    >
                      {complete
                        ? "Selection complete ✓"
                        : quote.rooms > 1
                          ? `Choose for room ${selected.length + 1}`
                          : "Choose this proposal →"}
                    </button>
                  )}
                  <p className="mt-3 whitespace-pre-line text-sm">
                    {treatment.key === "breakfast"
                      ? option.breakfastDetails
                      : treatment.key === "half_board"
                        ? option.halfBoardDetails
                        : option.fullBoardDetails}
                  </p>
                </div>
              ))}
            </div>
            {(option.hotelImageUrl || option.roomImageUrl) && (
              <div className="mt-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={option.hotelName}
                  src={option.roomImageUrl || option.hotelImageUrl}
                  className="max-h-64 w-full rounded-2xl object-cover"
                />
              </div>
            )}
            {option.includedServices && (
              <div className="mt-4">
                <h4 className="font-bold">Included services</h4>
                <p className="whitespace-pre-line text-sm leading-6">
                  {option.includedServices}
                </p>
              </div>
            )}
            {option.notes && (
              <p className="mt-3 whitespace-pre-line text-sm">{option.notes}</p>
            )}
            {option.commitmentNote && (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold">
                {option.commitmentNote}
              </p>
            )}
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer font-bold">
                Payment and cancellation conditions
              </summary>
              <div className="mt-2 space-y-2 whitespace-pre-line">
                <p>{option.paymentPolicy}</p>
                <p>{option.balanceMethod}</p>
                <p>{option.paymentNotes}</p>
                <p>{option.cancellationPolicy}</p>
              </div>
            </details>
          </div>
        </section>
      ))}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 p-4 font-bold text-rose-800"
        >
          {error}
        </p>
      )}
      {confirmed ? (
        <p className="rounded-2xl bg-emerald-50 p-5 font-bold">
          We have received your selection. Please refer to our confirmation
          email for the current booking and payment details.
        </p>
      ) : done ? (
        <section className="rounded-2xl bg-emerald-50 p-5">
          <h2 className="text-xl font-black">
            Thank you! We have received your request.
          </h2>
          <p className="mt-2">
            Our team will check availability with the hotel and contact you to
            complete your booking. No payment is required at this stage.
          </p>
        </section>
      ) : (
        <form
          ref={form}
          onSubmit={submit}
          className="rounded-2xl bg-white p-5 shadow-soft"
        >
          {selected.length > 0 && (
            <div className="mb-4 rounded-xl bg-ischia-mist p-4">
              {selected.map((room, index) => (
                <p key={index} className="text-sm">
                  Room {index + 1}: {room.hotelName} · {room.roomTypeLabel} ·{" "}
                  {room.treatmentLabel} · {englishMoney(room.price)}
                </p>
              ))}
              <p className="mt-2 font-black">
                Accommodation total: {englishMoney(total)}
              </p>
              {deposit > 0 && (
                <p className="text-sm">
                  Deposit: {englishMoney(deposit)} · Remaining balance:{" "}
                  {englishMoney(total - deposit)}
                </p>
              )}
              <button
                type="button"
                className="no-print mt-2 text-sm underline"
                onClick={() => setSelected([])}
              >
                Clear selection
              </button>
            </div>
          )}
          <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm font-bold">
            Payment details for the deposit will only be sent after availability
            has been checked with the hotel.
          </p>
          <h2
            ref={heading}
            tabIndex={-1}
            className="scroll-mt-4 rounded-xl bg-ischia-sun px-4 py-3 text-lg font-bold"
          >
            Complete the form with your personal details
          </h2>
          {!complete && (
            <p className="my-3 text-sm">
              Please select{" "}
              {quote.rooms === 1 ? "a proposal" : `all ${quote.rooms} rooms`}{" "}
              above before submitting.
            </p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              {
                name: "firstName",
                label: "First name",
                value: quote.customerFirstName,
              },
              {
                name: "lastName",
                label: "Last name",
                value: quote.customerLastName,
              },
              {
                name: "phone",
                label: "Phone / WhatsApp (include country code)",
                value: quote.customerPhone,
              },
              {
                name: "email",
                label: "Email",
                type: "email",
                value: quote.customerEmail,
              },
              { name: "address", label: "Home address" },
              { name: "city", label: "City / town" },
              { name: "postalCode", label: "Postcode / ZIP code" },
              { name: "country", label: "Country" },
              {
                name: "province",
                label: "County / state (optional)",
                optional: true,
              },
              {
                name: "fiscalCode",
                label: "Italian tax code (if you have one)",
                optional: true,
              },
            ].map((field) => (
              <label key={field.name} className="text-sm font-semibold">
                {field.label}
                <input
                  required={!field.optional}
                  name={field.name}
                  type={field.type ?? "text"}
                  defaultValue={field.value}
                  className="focus-ring mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2"
                />
              </label>
            ))}
          </div>
          {quote.children.map((child, index) => (
            <label key={child.id} className="mt-3 block text-sm font-semibold">
              Child {index + 1}: date of birth
              <input
                required
                type="date"
                name={`child-${child.id}`}
                max={quote.arrivalDate}
                className="ml-3 rounded-xl border p-2"
              />
            </label>
          ))}
          <label className="mt-4 flex gap-2 text-sm">
            <input required type="checkbox" name="acceptedTerms" />I accept the
            selected proposal, payment terms and cancellation conditions shown
            above.
          </label>
          <label className="mt-3 flex gap-2 text-sm">
            <input required type="checkbox" name="acceptedPrivacy" />I have read
            the{" "}
            <a
              href="https://acconsento.click/informative/page/11226/en"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              privacy notice
            </a>{" "}
            and consent to the processing of my personal data for this booking
            request.
          </label>
          <div className="no-print mt-5 text-center">
            <button
              type="submit"
              disabled={!complete || busy}
              className="rounded-full bg-ischia-sun px-5 py-3 text-sm font-bold disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send booking request"}
            </button>
            <p className="mt-2 text-xs">
              We will confirm availability before requesting your deposit.
            </p>
          </div>
        </form>
      )}
      <footer className="rounded-2xl bg-ischia-navy p-5 text-center text-sm text-white">
        <p className="font-bold">
          Ischia Stars · Your Ischia holiday specialists
        </p>
        <p className="mt-2">
          <a href="tel:+39081905481">+39 081 90 54 81</a> ·{" "}
          <a href={whatsapp}>WhatsApp +39 371 75 90 017</a>
        </p>
        <a href="mailto:info@ischiastars.it">info@ischiastars.it</a>
      </footer>
    </main>
  );
}
