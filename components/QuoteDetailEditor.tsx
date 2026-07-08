"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent, InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useEffect, useRef, useState } from "react";
import { CloneQuoteButton } from "@/components/CloneQuoteButton";
import { ConfirmationAvailabilityPanel } from "@/components/ConfirmationAvailabilityPanel";
import { EmailTrackingStatus } from "@/components/EmailTrackingStatus";
import type { EmailLog } from "@/lib/repositories/emailLogs";
import {
  HotelOptionState,
  HotelOptionsEditor,
  hotelOptionLabel,
  hotelOptionNeedsPrice,
  mapHotelOptionsToPayload,
  quoteOptionsToHotelOptionState,
  suggestedGuestsPerRoom
} from "@/components/HotelOptionsEditor";
import { QuoteStatusBadge } from "@/components/QuoteStatusBadge";
import { WhatsAppSendButton } from "@/components/WhatsAppSendButton";
import { adminApiErrorMessage, adminApiFetch, readAdminApiJson } from "@/lib/admin-api-client";
import { FeatureFlags } from "@/lib/feature-flags";
import { PaymentSettings } from "@/lib/payment-settings";
import { getEffectiveHotelOptions } from "@/lib/repositories/shared";
import { getBalancePaymentSchedule, isBalanceMethodInStructure } from "@/lib/hotel-policies";
import { Hotel, Quote, QuoteEvent, QuoteStatus, TransportOffer } from "@/lib/types";
import { formatCurrency, formatDate, publicQuoteUrl } from "@/lib/utils";

const statusOptions: QuoteStatus[] = ["in_lavorazione", "confermato", "perso_non_disponibile"];

const PUBLIC_NOTE_CHIPS = [
  "Traghetto da Napoli € 33 a persona a/r con transfer",
  "Ultime disponibilità",
  "Costi intesi per ogni camera",
  "Quota cane 20 euro al giorno da pagare in loco"
];

function todayDateString() {
  return new Date().toISOString().split("T")[0];
}

function tomorrowDateString() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().split("T")[0];
}

type ConfirmationEditForm = {
  selectionKey: string;
  firstName: string;
  lastName: string;
  fiscalCode: string;
  phone: string;
  email: string;
  address: string;
  selectedHotelOptionId: string;
  selectedHotelName: string;
  selectedTreatmentKey: string;
  selectedTreatmentLabel: string;
  selectedPrice: string;
  selectedDepositAmount: string;
  selectedBalanceAmount: string;
  selectedBalanceMethod: string;
  selectedPaymentPolicy: string;
  selectedCancellationPolicy: string;
};

function buildConfirmationEditForm(quote: Quote): ConfirmationEditForm {
  const confirmation = quote.confirmation;
  const selectedHotelOptionId = confirmation?.selectedHotelOptionId ?? "";
  const selectedTreatmentKey = confirmation?.selectedTreatmentKey ? String(confirmation.selectedTreatmentKey) : "";
  return {
    selectionKey: selectedHotelOptionId && selectedTreatmentKey ? `${selectedHotelOptionId}:${selectedTreatmentKey}` : "",
    firstName: confirmation?.firstName ?? quote.customerFirstName,
    lastName: confirmation?.lastName ?? quote.customerLastName,
    fiscalCode: confirmation?.fiscalCode ?? "",
    phone: confirmation?.phone ?? quote.customerPhone,
    email: confirmation?.email ?? quote.customerEmail,
    address: confirmation?.address ?? "",
    selectedHotelOptionId,
    selectedHotelName: confirmation?.selectedHotelName ?? quote.proposedHotel?.name ?? "",
    selectedTreatmentKey,
    selectedTreatmentLabel: confirmation?.selectedTreatmentLabel ?? "",
    selectedPrice: confirmation?.selectedPrice != null ? String(confirmation.selectedPrice) : String(quote.totalPrice || ""),
    selectedDepositAmount: confirmation?.selectedDepositAmount != null ? String(confirmation.selectedDepositAmount) : String(quote.deposit || ""),
    selectedBalanceAmount: confirmation?.selectedBalanceAmount != null ? String(confirmation.selectedBalanceAmount) : "",
    selectedBalanceMethod: confirmation?.selectedBalanceMethod ?? "",
    selectedPaymentPolicy: confirmation?.selectedPaymentPolicy ?? "",
    selectedCancellationPolicy: confirmation?.selectedCancellationPolicy ?? ""
  };
}

function confirmationSelectionOptions(quote: Quote) {
  return quote.hotelOptions.flatMap((option) =>
    option.treatments.map((treatment) => ({
      key: `${option.id}:${treatment.key}`,
      optionId: option.id,
      treatmentKey: treatment.key,
      hotelName: option.hotelName,
      treatmentLabel: [option.roomTypeLabel, treatment.label].filter(Boolean).join(", "),
      price: treatment.price,
      depositPercent: option.depositPercent ?? quote.confirmation?.selectedDepositPercent ?? 20,
      balanceMethod: option.balanceMethod ?? quote.confirmation?.selectedBalanceMethod ?? "",
      paymentPolicy: option.paymentPolicy ?? quote.confirmation?.selectedPaymentPolicy ?? "",
      cancellationPolicy: option.cancellationPolicy ?? quote.confirmation?.selectedCancellationPolicy ?? ""
    }))
  );
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function QuoteDetailEditor({ quote, hotels, paymentSettings, featureFlags, quoteEvents = [], emailLogs = [] }: { quote: Quote; hotels: Hotel[]; paymentSettings: PaymentSettings; featureFlags: FeatureFlags; quoteEvents?: QuoteEvent[]; emailLogs?: EmailLog[] }) {
  const router = useRouter();
  const effective = getEffectiveHotelOptions(quote);
  const [currentQuote, setCurrentQuote] = useState(quote);
  const [adultsCount, setAdultsCount] = useState(quote.adults);
  const [hasChildren, setHasChildren] = useState(quote.children.length > 0);
  const [childrenCount, setChildrenCount] = useState(quote.children.length);
  const [roomsCount, setRoomsCount] = useState(quote.rooms);
  const [checkIn, setCheckIn] = useState(quote.arrivalDate);
  const [checkOut, setCheckOut] = useState(quote.departureDate);
  const [hotelOptions, setHotelOptions] = useState<HotelOptionState[]>(quoteOptionsToHotelOptionState(effective));
  const [transportOffers] = useState<TransportOffer[]>(withDefaultTransportOffers(quote.transportOffers));
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [confirmationEditOpen, setConfirmationEditOpen] = useState(false);
  const [confirmationSaving, setConfirmationSaving] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const [confirmationForm, setConfirmationForm] = useState<ConfirmationEditForm>(() => buildConfirmationEditForm(quote));

  useEffect(() => {
    setConfirmationForm(buildConfirmationEditForm(currentQuote));
  }, [currentQuote]);

  function updateConfirmationForm(patch: Partial<ConfirmationEditForm>) {
    setConfirmationForm((current) => ({ ...current, ...patch }));
  }

  function applyConfirmationSelection(selectionKey: string) {
    const selection = confirmationSelectionOptions(currentQuote).find((item) => item.key === selectionKey);
    if (!selection) {
      updateConfirmationForm({
        selectionKey: "",
        selectedHotelOptionId: "",
        selectedTreatmentKey: ""
      });
      return;
    }

    const depositAmount = roundMoney(selection.price * (selection.depositPercent / 100));
    updateConfirmationForm({
      selectionKey,
      selectedHotelOptionId: selection.optionId,
      selectedHotelName: selection.hotelName,
      selectedTreatmentKey: selection.treatmentKey,
      selectedTreatmentLabel: selection.treatmentLabel,
      selectedPrice: String(selection.price),
      selectedDepositAmount: String(depositAmount),
      selectedBalanceAmount: String(roundMoney(selection.price - depositAmount)),
      selectedBalanceMethod: selection.balanceMethod,
      selectedPaymentPolicy: selection.paymentPolicy,
      selectedCancellationPolicy: selection.cancellationPolicy
    });
  }

  async function saveConfirmationDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentQuote.confirmation?.id) return;
    setConfirmationSaving(true);
    setConfirmationMessage(null);

    const response = await adminApiFetch(`/api/quote-confirmations/${currentQuote.confirmation.id}/details`, {
      method: "PATCH",
      body: JSON.stringify(confirmationForm)
    });
    const result = await readAdminApiJson<{ success?: boolean; quote?: Quote; error?: string }>(response);
    setConfirmationSaving(false);
    if (!response.ok || !result?.success || !result.quote) {
      setConfirmationMessage(adminApiErrorMessage(response, result, "Riepilogo non aggiornato."));
      return;
    }
    setCurrentQuote(result.quote);
    setConfirmationEditOpen(false);
    setConfirmationMessage("Riepilogo prenotazione aggiornato.");
    router.refresh();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const formData = new FormData(event.currentTarget);

    const optionsWithoutPrice = hotelOptions
      .map((option, index) => ({ option, index }))
      .filter(({ option }) => hotelOptionNeedsPrice(option));
    if (optionsWithoutPrice.length > 0) {
      setMessage(`Inserisci almeno un prezzo valido oppure rimuovi: ${optionsWithoutPrice.map(({ option, index }) => hotelOptionLabel(option, index)).join(", ")}.`);
      setLoading(false);
      return;
    }

    const mappedOptions = mapHotelOptionsToPayload(hotelOptions, { preserveGroups: true });
    const children = hasChildren
      ? Array.from({ length: childrenCount }, (_, index) => ({
          age: Number(formData.get(`child-${index}`) ?? ""),
          birthDate: currentQuote.children[index]?.birthDate || undefined
        }))
      : [];

    if (children.some((child) => !Number.isInteger(child.age) || child.age < 0 || child.age > 17)) {
      setMessage("Inserisci l'età (0-17 anni) per ogni bambino.");
      setLoading(false);
      return;
    }

    if (mappedOptions.length === 0) {
      setMessage("Inserisci almeno un prezzo valido in almeno una struttura prima di salvare.");
      setLoading(false);
      return;
    }

    const payload = {
      clientFirstName: formData.get("firstName"),
      clientLastName: formData.get("lastName"),
      clientEmail: formData.get("email"),
      clientPhone: formData.get("phone"),
      hotelRequested: formData.get("hotelRequested"),
      hotelId: hotelOptions[0]?.hotelId || undefined,
      checkIn: formData.get("checkIn"),
      checkOut: formData.get("checkOut"),
      adults: Number(formData.get("adults") ?? 2),
      children,
      rooms: Number(formData.get("rooms") ?? 1),
      totalPrice: Number(formData.get("totalPrice") ?? 0),
      depositAmount: Number(formData.get("depositAmount") ?? 0),
      validUntil: formData.get("validUntil"),
      transportOffers,
      publicNotes: formData.get("publicNotes"),
      internalNotes: formData.get("internalNotes"),
      hotelOptions: mappedOptions
    };

    const response = await adminApiFetch(`/api/quotes/${currentQuote.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: Quote; source?: string; error?: string }>(response);
    setLoading(false);
    if (!response.ok || !result?.ok || !result.data) {
      setMessage(adminApiErrorMessage(response, result, "Salvataggio non riuscito."));
      return;
    }
    setCurrentQuote(result.data);
    setMessage("Preventivo aggiornato.");
    router.refresh();
  }

  async function changeStatus(status: QuoteStatus) {
    const response = await adminApiFetch(`/api/quotes/${currentQuote.id}`, {
      method: "PATCH",
      body: JSON.stringify({ statusOnly: true, status })
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: Quote; error?: string }>(response);
    if (response.ok && result?.data) {
      setCurrentQuote(result.data);
      router.refresh();
    }
  }

  async function toggleExcludeFromStats() {
    setMessage(null);
    const next = !currentQuote.excludedFromStats;
    if (next) {
      const ok = window.confirm(
        `Vuoi escludere il preventivo ${currentQuote.code} dalle statistiche?\n\nNon verrà conteggiato in dashboard, statistiche e liste operative principali. Potrai reincluderlo in seguito.`
      );
      if (!ok) return;
    }

    const response = await adminApiFetch(`/api/quotes/${currentQuote.id}`, {
      method: "PATCH",
      body: JSON.stringify({ excludedFromStats: next })
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: Quote; error?: string }>(response);
    if (response.ok && result?.data) {
      setCurrentQuote(result.data);
      setMessage(next ? "Preventivo escluso dalle statistiche." : "Preventivo reinclueso nelle statistiche.");
      router.refresh();
    } else {
      setMessage("Operazione non riuscita.");
    }
  }

  async function deleteCurrentQuote() {
    setMessage(null);
    const ok = window.confirm(`Vuoi cancellare il preventivo ${currentQuote.code}?\n\nVerrà nascosto dalle liste operative e dalle statistiche.`);
    if (!ok) return;
    const response = await adminApiFetch(`/api/quotes/${currentQuote.id}`, {
      method: "PATCH",
      body: JSON.stringify({ softDelete: true })
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: Quote }>(response);
    if (response.ok && result?.data) {
      setCurrentQuote(result.data);
      setMessage("Preventivo cancellato.");
      router.refresh();
    } else {
      setMessage("Cancellazione non riuscita.");
    }
  }

  async function restoreCurrentQuote() {
    setMessage(null);
    const response = await adminApiFetch(`/api/quotes/${currentQuote.id}`, {
      method: "POST",
      body: JSON.stringify({ action: "restore" })
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: Quote }>(response);
    if (response.ok && result?.data) {
      setCurrentQuote(result.data);
      setMessage("Preventivo ripristinato.");
      router.refresh();
    } else {
      setMessage("Ripristino non riuscito.");
    }
  }

  async function duplicateCurrentQuote() {
    setMessage(null);
    const response = await adminApiFetch(`/api/quotes/${currentQuote.id}`, {
      method: "POST",
      body: JSON.stringify({ action: "duplicate" })
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: Quote; error?: string }>(response);
    if (!response.ok || !result?.ok || !result.data) {
      setMessage(adminApiErrorMessage(response, result, "Duplicazione non riuscita."));
      return;
    }
    router.push(`/admin/preventivi/${result.data.code}`);
    router.refresh();
  }

  async function sendQuote() {
    setSending(true);
    setMessage(null);
    const response = await adminApiFetch(`/api/quotes/${currentQuote.id}`, {
      method: "POST",
      body: JSON.stringify({ action: "send" })
    });
    const result = await readAdminApiJson<{ ok?: boolean; data?: Quote; error?: string }>(response);
    setSending(false);
    if (response.ok && result?.data) {
      setCurrentQuote(result.data);
      setSent(true);
      setMessage("Preventivo inviato al cliente.");
      router.refresh();
    } else {
      setMessage(adminApiErrorMessage(response, result, "Impossibile inviare il preventivo. Riprova."));
    }
  }

  const isConfirmed = !!currentQuote.confirmation;
  const activeHotels = hotels.filter((h) => h.active);
  const roomCapacitySuggestion = suggestedGuestsPerRoom(adultsCount + (hasChildren ? childrenCount : 0), roomsCount);
  const isQuoteSent = sent || currentQuote.status === "preventivo_inviato";

  // Struttura selezionata dal cliente (se confermata con opzione)
  const effectiveOptions = getEffectiveHotelOptions(currentQuote);
  const selectedOption = currentQuote.confirmation?.selectedHotelOptionId
    ? effectiveOptions.find((o) => o.id === currentQuote.confirmation?.selectedHotelOptionId)
    : effectiveOptions.find((o) => o.isSelected);
  const confirmedSelection = [
    currentQuote.confirmation?.selectedHotelName ?? selectedOption?.hotelName,
    selectedOption?.roomTypeLabel,
    currentQuote.confirmation?.selectedTreatmentLabel,
    currentQuote.confirmation?.selectedPrice != null ? formatCurrency(currentQuote.confirmation.selectedPrice) : undefined
  ].filter(Boolean).join(" - ");
  const confirmationSelections = confirmationSelectionOptions(currentQuote);
  const confirmationName = `${currentQuote.confirmation?.firstName ?? currentQuote.customerFirstName} ${currentQuote.confirmation?.lastName ?? currentQuote.customerLastName}`.trim();

  const reactionEvents = quoteEvents
    .filter((event) => event.eventType === "reaction_interested" || event.eventType === "reaction_too_expensive")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <div className="space-y-6">
      {currentQuote.confirmation ? <ConfirmationAvailabilityPanel quote={currentQuote} paymentSettings={paymentSettings} featureFlags={featureFlags} onConfirmationUpdated={setCurrentQuote} /> : null}

      {reactionEvents.length > 0 ? (
        <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-ischia-blue/10">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Reazioni cliente</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {reactionEvents.map((event) => {
              const hotelName = typeof event.metadata?.hotelName === "string" ? event.metadata.hotelName : "Hotel";
              const isInterested = event.eventType === "reaction_interested";
              return (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                    isInterested ? "bg-[#DCFCE7] text-[#16A34A]" : "bg-[#FEF2F2] text-[#DC2626]"
                  }`}
                  key={event.id}
                >
                  {isInterested ? "👍 Mi interessa" : "💸 Troppo caro"} — {hotelName}
                  <span className="text-gray-400">il {formatDate(event.createdAt)}</span>
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_0.36fr]">
      {isConfirmed ? (
        <div className="space-y-5">
          <section className="rounded-2xl bg-white/90 p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-black text-ischia-navy">Riepilogo prenotazione</h2>
              <button
                className="rounded-full bg-ischia-sun px-4 py-2 text-sm font-black text-ischia-navy disabled:opacity-60"
                onClick={() => {
                  setConfirmationEditOpen((open) => !open);
                  setConfirmationMessage(null);
                }}
                type="button"
              >
                {confirmationEditOpen ? "Chiudi modifica" : "Modifica riepilogo"}
              </button>
            </div>
            {confirmationMessage ? <p className="mt-3 rounded-xl bg-ischia-mist px-3 py-2 text-sm font-bold text-ischia-navy">{confirmationMessage}</p> : null}
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <ReadInfo label="Nome" value={confirmationName || "-"} />
              <ReadInfo label="Telefono" value={currentQuote.confirmation!.phone ?? currentQuote.customerPhone ?? "-"} />
              <ReadInfo label="Email" value={currentQuote.confirmation!.email ?? currentQuote.customerEmail ?? "-"} />
              <ReadInfo label="Codice fiscale" value={currentQuote.confirmation!.fiscalCode || "-"} />
              <ReadInfo label="Indirizzo" value={currentQuote.confirmation!.address || "-"} />
              <ReadInfo label="Bambini / Età" value={currentQuote.children.length ? currentQuote.children.map((child, index) => `B${index + 1}: ${childAgeForForm(child, currentQuote.arrivalDate) || "-"}`).join(", ") : "-"} />
              <ReadInfo label="Hotel" value={currentQuote.confirmation!.selectedHotelName ?? currentQuote.proposedHotel?.name ?? "-"} />
              <ReadInfo label="Trattamento" value={currentQuote.confirmation!.selectedTreatmentLabel ?? "-"} />
              <ReadInfo label="Date" value={`${formatDate(currentQuote.arrivalDate)} → ${formatDate(currentQuote.departureDate)}`} />
              <ReadInfo label="Adulti" value={String(currentQuote.adults)} />
              <ReadInfo label="Prezzo totale" value={currentQuote.confirmation!.selectedPrice != null ? formatCurrency(currentQuote.confirmation!.selectedPrice) : formatCurrency(currentQuote.totalPrice)} />
              <ReadInfo label="Caparra" value={currentQuote.confirmation!.selectedDepositAmount != null ? formatCurrency(currentQuote.confirmation!.selectedDepositAmount) : "-"} />
              <ReadInfo label="Saldo" value={currentQuote.confirmation!.selectedBalanceAmount != null ? formatCurrency(currentQuote.confirmation!.selectedBalanceAmount) : "-"} />
              <ReadInfo label="Modalità saldo" value={currentQuote.confirmation!.selectedBalanceMethod ?? "-"} />
              {(() => {
                const schedule = getBalancePaymentSchedule(currentQuote.confirmation!.selectedBalanceMethod, currentQuote.arrivalDate);
                return schedule.dueDate ? <ReadInfo label="Scadenza saldo" value={formatDate(schedule.dueDate)} /> : null;
              })()}
              <ReadInfo label="Policy cancellazione" value={currentQuote.confirmation!.selectedCancellationPolicy ?? "-"} />
            </div>
            {confirmationEditOpen ? (
              <form className="mt-5 space-y-4 rounded-2xl bg-ischia-mist/50 p-4 ring-1 ring-ischia-blue/10" onSubmit={saveConfirmationDetails}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="text-sm font-semibold text-ischia-ink lg:col-span-3">
                    Scegli una proposta del preventivo
                    <select
                      className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2"
                      value={confirmationForm.selectionKey}
                      onChange={(event) => applyConfirmationSelection(event.target.value)}
                    >
                      <option value="">Modifica manuale</option>
                      {confirmationSelections.map((selection) => (
                        <option key={selection.key} value={selection.key}>
                          {selection.hotelName} - {selection.treatmentLabel} - {formatCurrency(selection.price)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Input label="Nome" required value={confirmationForm.firstName} onChange={(event) => updateConfirmationForm({ firstName: event.target.value })} />
                  <Input label="Cognome" value={confirmationForm.lastName} onChange={(event) => updateConfirmationForm({ lastName: event.target.value })} />
                  <Input label="Telefono" required value={confirmationForm.phone} onChange={(event) => updateConfirmationForm({ phone: event.target.value })} />
                  <Input label="Email" required type="email" value={confirmationForm.email} onChange={(event) => updateConfirmationForm({ email: event.target.value })} />
                  <Input label="Codice fiscale" value={confirmationForm.fiscalCode} onChange={(event) => updateConfirmationForm({ fiscalCode: event.target.value })} />
                  <Input label="Indirizzo" value={confirmationForm.address} onChange={(event) => updateConfirmationForm({ address: event.target.value })} />
                  <Input label="Hotel scelto" required value={confirmationForm.selectedHotelName} onChange={(event) => updateConfirmationForm({ selectedHotelName: event.target.value, selectionKey: "" })} />
                  <Input label="Trattamento" required value={confirmationForm.selectedTreatmentLabel} onChange={(event) => updateConfirmationForm({ selectedTreatmentLabel: event.target.value, selectionKey: "" })} />
                  <Input label="Modalità saldo" required value={confirmationForm.selectedBalanceMethod} onChange={(event) => updateConfirmationForm({ selectedBalanceMethod: event.target.value })} />
                  <Input label="Prezzo" min="0" required step="0.01" type="number" value={confirmationForm.selectedPrice} onChange={(event) => updateConfirmationForm({ selectedPrice: event.target.value })} />
                  <Input label="Caparra" min="0" required step="0.01" type="number" value={confirmationForm.selectedDepositAmount} onChange={(event) => updateConfirmationForm({ selectedDepositAmount: event.target.value })} />
                  <Input label="Saldo" min="0" required step="0.01" type="number" value={confirmationForm.selectedBalanceAmount} onChange={(event) => updateConfirmationForm({ selectedBalanceAmount: event.target.value })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Textarea label="Policy pagamento" rows={3} value={confirmationForm.selectedPaymentPolicy} onChange={(value) => updateConfirmationForm({ selectedPaymentPolicy: value })} />
                  <Textarea label="Policy cancellazione" rows={3} value={confirmationForm.selectedCancellationPolicy} onChange={(value) => updateConfirmationForm({ selectedCancellationPolicy: value })} />
                </div>
                <button className="rounded-full bg-ischia-navy px-5 py-3 text-sm font-black text-white disabled:opacity-60" disabled={confirmationSaving} type="submit">
                  {confirmationSaving ? "Salvataggio..." : "Salva riepilogo"}
                </button>
              </form>
            ) : null}
          </section>
        </div>
      ) : (
      <form className="space-y-5" onSubmit={save}>
        {message ? <p className="rounded-2xl bg-ischia-mist p-4 text-sm font-bold text-ischia-navy">{message}</p> : null}

        <Section title="Cliente e soggiorno">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="firstName" label="Nome" defaultValue={currentQuote.customerFirstName} required />
            <Input name="lastName" label="Cognome" defaultValue={currentQuote.customerLastName} />
            <Input name="phone" label="Telefono WhatsApp" defaultValue={currentQuote.customerPhone} required />
            <Input name="email" label="Email" defaultValue={currentQuote.customerEmail} type="email" />
            <Input
              name="checkIn"
              label="Data arrivo"
              required
              type="date"
              min={todayDateString()}
              value={checkIn}
              onChange={(e) => {
                const value = e.target.value;
                setCheckIn(value);
                if (checkOut && checkOut <= value) setCheckOut("");
              }}
            />
            <Input
              name="checkOut"
              label="Data partenza"
              required
              type="date"
              min={checkIn || tomorrowDateString()}
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
            />
            <Input name="adults" label="Adulti" min="1" value={String(adultsCount)} onChange={(e) => setAdultsCount(Number(e.target.value) || 1)} required type="number" />
            <label className="flex items-center gap-3 rounded-xl bg-ischia-mist px-3 py-2 text-sm font-semibold text-ischia-ink sm:col-span-2">
              <input
                checked={hasChildren}
                className="h-4 w-4"
                onChange={(event) => {
                  const checked = event.target.checked;
                  setHasChildren(checked);
                  if (checked && childrenCount === 0) setChildrenCount(1);
                }}
                type="checkbox"
              />
              Aggiungi bambini
            </label>
            {hasChildren ? (
              <>
                <Input
                  label="Numero bambini"
                  min="1"
                  type="number"
                  value={String(childrenCount)}
                  onChange={(event) => setChildrenCount(Math.max(1, Number(event.target.value) || 1))}
                />
                {Array.from({ length: childrenCount }, (_, index) => (
                  <Input
                    key={index}
                    defaultValue={childAgeForForm(currentQuote.children[index], currentQuote.arrivalDate)}
                    label={`Età bambino ${index + 1}`}
                    max="17"
                    min="0"
                    name={`child-${index}`}
                    required
                    type="number"
                  />
                ))}
              </>
            ) : null}
            <Input name="rooms" label="Camere" min="1" value={String(roomsCount)} onChange={(e) => setRoomsCount(Number(e.target.value) || 1)} required type="number" />
            <Input name="hotelRequested" label="Hotel richiesto dal cliente" defaultValue={currentQuote.requestedHotel} />
          </div>
        </Section>

        <Section title="Proposte hotel">
          {confirmedSelection && (
            <div className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
              Scelta confermata: <strong>{confirmedSelection}</strong>
            </div>
          )}
          <p className="text-sm text-ischia-ink/65">Inserisci fino a 3 strutture. Lascia vuoto il prezzo di un trattamento per non mostrarlo.</p>
          <HotelOptionsEditor
            activeHotels={activeHotels}
            hotelOptions={hotelOptions}
            onChange={setHotelOptions}
            preserveGroups
            showStars={false}
            suggestedCapacity={roomCapacitySuggestion}
          />
        </Section>

        <Section title="Condizioni preventivo">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input name="totalPrice" label="Prezzo totale (legacy)" defaultValue={String(currentQuote.totalPrice)} type="number" />
            <Input name="depositAmount" label="Acconto" defaultValue={String(currentQuote.deposit)} required type="number" />
            <Input name="validUntil" label="Scadenza offerta" defaultValue={currentQuote.offerExpiresAt} required type="date" />
          </div>
          <Textarea name="publicNotes" label="Note visibili al cliente" defaultValue={currentQuote.customerNotes} noteChips={PUBLIC_NOTE_CHIPS} />
          <Textarea name="internalNotes" label="Note interne" defaultValue={currentQuote.internalNotes} />
        </Section>

        <button className="rounded-full bg-ischia-sun px-5 py-3 font-black text-ischia-navy disabled:opacity-60" disabled={loading} type="submit">
          {loading ? "Salvataggio..." : "Salva modifiche"}
        </button>
      </form>
      )}

      <aside className="space-y-4">
        {currentQuote.confirmation ? (
          <ConfirmationStatusCard confirmation={currentQuote.confirmation} arrivalDate={currentQuote.arrivalDate} />
        ) : null}

        {/* Card principale: codice + stato + azioni chiave */}
        <div className="rounded-2xl bg-white/90 p-5 text-center shadow-soft">
          <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:justify-between">
            <h2 className="text-xl font-black text-ischia-navy">{currentQuote.code}</h2>
            <QuoteStatusBadge status={currentQuote.status} />
          </div>

          {/* Riepilogo hotel options (dopo il fix undefined) */}
          {getEffectiveHotelOptions(currentQuote).filter((o) => o.hotelName).length > 0 && (
            <div className="mt-3 space-y-1 text-sm text-ischia-ink/70">
              {getEffectiveHotelOptions(currentQuote).filter((o) => o.hotelName).map((opt) => (
                <p key={opt.id} className={opt.isSelected ? "font-bold text-emerald-700" : ""}>
                  {opt.isSelected ? "? " : ""}{opt.hotelName}
                  {opt.treatments.length > 0 && ` - ${opt.treatments.map((t) => formatCurrency(t.price)).join(" / ")}`}
                </p>
              ))}
            </div>
          )}

          {/* Stato "inviato": mostra solo WhatsApp */}
          {isQuoteSent ? (
            <div className="mt-5 grid gap-3 [&_a]:block [&_a]:text-center">
              <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
                Preventivo già inviato. Puoi reinviare il link al cliente su WhatsApp{currentQuote.isLabTest ? " oppure ripetere il test email." : "."}
              </div>
              {currentQuote.isLabTest ? (
                <button
                  className="rounded-full bg-ischia-leaf px-4 py-2 text-center text-sm font-black text-white disabled:opacity-60"
                  disabled={sending}
                  onClick={() => void sendQuote()}
                  type="button"
                >
                  {sending ? "Invio email..." : "Reinvia email di test"}
                </button>
              ) : null}
              <WhatsAppSendButton quote={currentQuote} label="Invia link su WhatsApp" />
              <Link className="block rounded-full bg-ischia-navy px-4 py-2 text-center text-sm font-black text-white" href={publicQuoteUrl(currentQuote)} rel="noopener noreferrer" target="_blank">
                Apri link cliente
              </Link>
            </div>
          ) : currentQuote.confirmation ? (
            <div className="mt-5 grid gap-2 [&_a]:block [&_a]:text-center">
              <Link className="rounded-full bg-ischia-navy px-4 py-2 text-center text-sm font-black text-white" href={publicQuoteUrl(currentQuote)} rel="noopener noreferrer" target="_blank">
                Apri link cliente
              </Link>
              <WhatsAppSendButton quote={currentQuote} />
              <button className="rounded-full bg-ischia-sun px-4 py-2 text-sm font-black text-ischia-navy" onClick={() => void duplicateCurrentQuote()} type="button">
                Duplica preventivo
              </button>
            </div>
          ) : (
            <div className="mt-5 grid gap-2 [&_a]:block [&_a]:text-center">
              <Link
                className="rounded-full bg-ischia-navy/10 px-4 py-2 text-center text-sm font-bold text-ischia-navy ring-1 ring-ischia-navy/20"
                href={publicQuoteUrl(currentQuote)}
                rel="noopener noreferrer"
                target="_blank"
              >
                Apri anteprima cliente
              </Link>
              <button
                className="rounded-full bg-ischia-leaf px-4 py-2 text-center text-sm font-black text-white disabled:opacity-60"
                disabled={sending}
                onClick={() => void sendQuote()}
                type="button"
              >
                {sending ? "Aggiornamento..." : "Invia preventivo"}
              </button>
              <WhatsAppSendButton quote={currentQuote} />
              <button className="rounded-full bg-ischia-sun px-4 py-2 text-sm font-black text-ischia-navy" onClick={() => void duplicateCurrentQuote()} type="button">
                Duplica preventivo
              </button>
            </div>
          )}
        </div>

        {/* Cambia stato manuale */}
        {!isQuoteSent && !isConfirmed && (
          <div className="rounded-2xl bg-white/90 p-5 text-center shadow-soft">
            <h3 className="font-black text-ischia-navy">Cambia stato</h3>
            <div className="mt-3 grid gap-2">
              {statusOptions.map((status) => (
                <button key={status} className="rounded-full bg-white px-4 py-2 text-sm font-black text-ischia-navy ring-1 ring-ischia-blue/20" onClick={() => void changeStatus(status)} type="button">
                  {statusLabel(status)}
                </button>
              ))}
            </div>
          </div>
        )}

        {emailLogs.length > 0 ? <EmailTrackingStatus emailLogs={emailLogs} /> : null}

        {/* Azioni preventivo */}
        <div className="rounded-2xl bg-white/90 p-5 text-center shadow-soft">
          <h3 className="font-black text-ischia-navy">Azioni preventivo</h3>
          {currentQuote.excludedFromStats && !currentQuote.deletedAt ? (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Escluso dalle statistiche</p>
          ) : null}
          {currentQuote.deletedAt ? (
            <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">Preventivo cancellato</p>
          ) : null}
          <div className="mt-3 grid gap-2">
            {!currentQuote.deletedAt ? (
              <button className="rounded-full bg-white px-4 py-2 text-sm font-black text-amber-700 ring-1 ring-amber-200" onClick={() => void toggleExcludeFromStats()} type="button">
                {currentQuote.excludedFromStats ? "Reincludi nelle statistiche" : "Escludi dalle statistiche"}
              </button>
            ) : null}
            <CloneQuoteButton quoteId={currentQuote.id} />
            {currentQuote.deletedAt ? (
              <button className="rounded-full bg-ischia-leaf px-4 py-2 text-sm font-black text-white" onClick={() => void restoreCurrentQuote()} type="button">
                Ripristina preventivo
              </button>
            ) : (
              <button className="rounded-full bg-rose-50 px-4 py-2 text-sm font-black text-rose-700 ring-1 ring-rose-100" onClick={() => void deleteCurrentQuote()} type="button">
                Cancella preventivo
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
    </div>
  );
}

function ConfirmationStatusCard({ confirmation, arrivalDate }: { confirmation: NonNullable<Quote["confirmation"]>; arrivalDate: string }) {
  const status = confirmation.availabilityStatus ?? "availability_to_check";
  const isInHotelBalance = isBalanceMethodInStructure(confirmation.selectedBalanceMethod);
  const balanceSchedule = getBalancePaymentSchedule(confirmation.selectedBalanceMethod, arrivalDate);
  const allDone = confirmation.balancePaidAt || (isInHotelBalance && confirmation.depositPaidAt);

  if (allDone) {
    return (
      <div className="rounded-2xl bg-emerald-50/80 p-5 shadow-soft ring-1 ring-emerald-200">
        <h3 className="font-black text-ischia-navy">✓ Tutto confermato</h3>
        <p className="mt-2 text-sm font-semibold text-emerald-800">
          {confirmation.balancePaidAt ? "Saldo ricevuto. Prenotazione completata." : "Caparra ricevuta. Saldo in struttura all'arrivo."}
        </p>
      </div>
    );
  }

  if (status === "deposit_waiting" && confirmation.depositPaidAt) {
    return (
      <div className="rounded-2xl bg-emerald-50/80 p-5 shadow-soft ring-1 ring-emerald-200">
        <h3 className="font-black text-ischia-navy">✓ Caparra ricevuta</h3>
        <p className="mt-2 text-sm font-semibold text-emerald-800">
          {balanceSchedule.dueDate ? `Saldo da ricevere entro il ${formatDate(balanceSchedule.dueDate)}.` : "In attesa del saldo dal cliente."}
        </p>
        <a className="mt-4 block rounded-full bg-ischia-leaf px-4 py-2 text-center text-sm font-black text-white" href="#verifica-disponibilita">
          Gestisci saldo e voucher
        </a>
      </div>
    );
  }

  if (status === "deposit_waiting") {
    return (
      <div className="rounded-2xl bg-amber-50 p-5 shadow-soft ring-1 ring-amber-200">
        <h3 className="font-black text-ischia-navy">In attesa caparra</h3>
        <p className="mt-2 text-sm font-semibold text-amber-800">Email di conferma inviata. Aspettiamo il bonifico del cliente.</p>
        <a className="mt-4 block rounded-full bg-ischia-navy px-4 py-2 text-center text-sm font-black text-white" href="#verifica-disponibilita">
          Registra caparra
        </a>
      </div>
    );
  }

  if (status === "availability_confirmed") {
    return (
      <div className="rounded-2xl bg-emerald-50/80 p-5 shadow-soft ring-1 ring-emerald-200">
        <h3 className="font-black text-ischia-navy">✓ Struttura disponibile</h3>
        <p className="mt-2 text-sm font-semibold text-emerald-800">Invia la conferma definitiva al cliente con le coordinate di pagamento.</p>
        <a className="mt-4 block rounded-full bg-ischia-leaf px-4 py-2 text-center text-sm font-black text-white" href="#verifica-disponibilita">
          Invia conferma definitiva
        </a>
      </div>
    );
  }

  if (status === "availability_unavailable" || status === "alternative_to_propose") {
    return (
      <div className="rounded-2xl bg-rose-50 p-5 shadow-soft ring-1 ring-rose-200">
        <h3 className="font-black text-ischia-navy">Struttura non disponibile</h3>
        <p className="mt-2 text-sm font-semibold text-rose-800">Email di indisponibilità inviata al cliente.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-emerald-50/80 p-5 shadow-soft ring-1 ring-emerald-200">
      <h3 className="font-black text-ischia-navy">Conferma cliente ricevuta</h3>
      <p className="mt-2 text-sm font-semibold text-emerald-800">Verifica la disponibilità con la struttura e procedi.</p>
      <a className="mt-4 block rounded-full bg-ischia-leaf px-4 py-2 text-center text-sm font-black text-white" href="#verifica-disponibilita">
        Gestisci disponibilità
      </a>
    </div>
  );
}

function ReadInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ischia-mist p-3">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-ischia-blue/75">{label}</p>
      <p className="mt-1 font-semibold text-ischia-ink">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl bg-white/90 p-5 shadow-soft"><h2 className="text-xl font-black text-ischia-navy">{title}</h2><div className="mt-4 space-y-3">{children}</div></section>;
}

function Input({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return <label className="text-sm font-semibold text-ischia-ink">{label}<input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" {...props} /></label>;
}

function childAgeForForm(child: Quote["children"][number] | undefined, arrivalDate: string) {
  if (child?.age != null) return String(child.age);
  if (!child?.birthDate || !arrivalDate) return "";
  const birth = new Date(`${child.birthDate}T00:00:00`);
  const arrival = new Date(`${arrivalDate}T00:00:00`);
  if (!Number.isFinite(birth.getTime()) || !Number.isFinite(arrival.getTime())) return "";
  let age = arrival.getFullYear() - birth.getFullYear();
  if (arrival.getMonth() < birth.getMonth() || (arrival.getMonth() === birth.getMonth() && arrival.getDate() < birth.getDate())) age--;
  return age >= 0 && age <= 17 ? String(age) : "";
}

function Textarea({ label, value, onChange, onInput, noteChips, ...props }: { label: string; value?: string; onChange?: (value: string) => void; noteChips?: string[] } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value">) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    resizeTextarea(ref.current);
  }, [value, props.defaultValue]);

  function appendNoteChip(note: string) {
    const textarea = ref.current;
    if (!textarea) return;
    const currentValue = value ?? textarea.value;
    if (currentValue.includes(note)) {
      textarea.focus();
      return;
    }
    const separator = currentValue.trim().length > 0 && !currentValue.endsWith("\n") ? "\n" : "";
    const nextValue = `${currentValue}${separator}${note}`;
    if (onChange) {
      onChange(nextValue);
    } else {
      textarea.value = nextValue;
    }
    window.requestAnimationFrame(() => {
      resizeTextarea(textarea);
      textarea.focus();
    });
  }

  return (
    <div className="block text-sm font-semibold text-ischia-ink">
      <label htmlFor={props.id ?? props.name}>{label}</label>
      {noteChips?.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {noteChips.map((note) => (
            <button
              className="rounded-full border border-ischia-blue/20 bg-ischia-mist px-3 py-1 text-xs font-bold text-ischia-navy transition hover:border-ischia-blue/40 hover:bg-white"
              key={note}
              type="button"
              onClick={() => appendNoteChip(note)}
            >
              {note}
            </button>
          ))}
        </div>
      ) : null}
      <textarea
        className="mt-1 min-h-24 w-full resize-y overflow-hidden whitespace-pre-wrap break-words rounded-xl border border-ischia-blue/20 px-3 py-2 leading-6"
        ref={ref}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        onInput={(event) => {
          resizeTextarea(event.currentTarget);
          onInput?.(event);
        }}
        wrap="soft"
        {...props}
      />
    </div>
  );
}

function resizeTextarea(element: HTMLTextAreaElement | null) {
  if (!element) return;
  element.style.height = "auto";
  element.style.height = `${Math.max(element.scrollHeight, 96)}px`;
}

function withDefaultTransportOffers(offers: TransportOffer[] = []): TransportOffer[] {
  return offers;
}

function statusLabel(status: QuoteStatus) {
  if (status === "preventivo_inviato") return "Preventivo inviato";
  if (status === "confermato") return "Confermato";
  if (status === "perso_non_disponibile") return "Perso / non disponibile";
  if (status === "in_lavorazione") return "In lavorazione";
  return "Da evadere";
}


