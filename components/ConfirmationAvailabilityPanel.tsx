"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApiErrorMessage, adminApiFetch, adminApiHeaders, readAdminApiJson } from "@/lib/admin-api-client";
import { formatConfirmationAdditionalService, getConfirmationAdditionalServices } from "@/lib/confirmation-additional-services";
import { availabilityStatusLabel, defaultUnavailabilityMessage, depositCoordinatesWhatsappMessage, formatDepositDueLocalInput } from "@/lib/confirmation-availability";
import { FeatureFlags } from "@/lib/feature-flags";
import { getBalancePaymentSchedule, isBalanceMethodInStructure } from "@/lib/hotel-policies";
import { buildPaymentReason, isPaymentSettingsConfigured, PaymentSettings } from "@/lib/payment-settings";
import { Quote } from "@/lib/types";
import { formatCurrency, formatDate, formatDateTime, normalizeItalianPhone } from "@/lib/utils";

type VoucherEmailApiResult = {
  ok?: boolean;
  success?: boolean;
  error?: string;
  quote?: Quote;
  paymentSaved?: boolean;
  voucherEmailSent?: boolean;
  voucherEmailError?: string | null;
};

export function ConfirmationAvailabilityPanel({ quote, paymentSettings, featureFlags, onConfirmationUpdated }: { quote: Quote; paymentSettings: PaymentSettings; featureFlags: FeatureFlags; onConfirmationUpdated?: (quote: Quote) => void }) {
  const router = useRouter();
  const confirmation = quote.confirmation;
  const defaultSelectedPrice = confirmation?.selectedPrice ?? quote.totalPrice;
  const defaultDepositAmount = confirmation?.selectedDepositAmount ?? quote.deposit;
  const [message, setMessage] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [depositDueAt, setDepositDueAt] = useState(() => confirmationDepositDueLocalInput(confirmation?.depositDueAt));
  const [finalNotes, setFinalNotes] = useState("");
  const [unavailableReason, setUnavailableReason] = useState("");
  const [alternativeToPropose, setAlternativeToPropose] = useState(false);
  const [unavailableMessage, setUnavailableMessage] = useState(defaultUnavailabilityMessage(quote.customerFirstName, quote.code));
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierSentInfo, setSupplierSentInfo] = useState<{ email: string; sentAt: string } | null>(null);
  const [supplierRecipientEmail, setSupplierRecipientEmail] = useState("");
  const [supplierNetPrice, setSupplierNetPrice] = useState("");
  const [supplierNotes, setSupplierNotes] = useState("");
  const [supplierSending, setSupplierSending] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [depositCoordinatesCopied, setDepositCoordinatesCopied] = useState(false);
  const [depositAmountOverride, setDepositAmountOverride] = useState(formatAmountInput(defaultDepositAmount));
  const [balanceAmountOverride, setBalanceAmountOverride] = useState("");
  const [serviceLabel, setServiceLabel] = useState("");
  const [serviceCost, setServiceCost] = useState("");
  const [newTotalPrice, setNewTotalPrice] = useState(formatAmountInput(defaultSelectedPrice));
  const [newDepositAmount, setNewDepositAmount] = useState(formatAmountInput(defaultDepositAmount));
  const [totalManuallyEdited, setTotalManuallyEdited] = useState(false);
  const [voucherNotes, setVoucherNotes] = useState(confirmation?.voucherNotes ?? "");
  const [editingCustomerDetails, setEditingCustomerDetails] = useState(false);
  const [customerFirstName, setCustomerFirstName] = useState(confirmation?.firstName ?? quote.customerFirstName);
  const [customerLastName, setCustomerLastName] = useState(confirmation?.lastName ?? quote.customerLastName);
  const [customerEmail, setCustomerEmail] = useState(confirmation?.email ?? quote.customerEmail);
  const [customerPhone, setCustomerPhone] = useState(confirmation?.phone ?? quote.customerPhone);

  const confirmationId = confirmation?.id;
  const storedStatus = confirmation?.availabilityStatus ?? "availability_to_check";
  const status = storedStatus === "availability_confirmed" && confirmation?.finalConfirmationSentAt
    ? "deposit_waiting"
    : storedStatus;
  const isManualEmailImport = confirmation?.metadata?.source === "manual_email_import";
  const canSendFinal = status === "availability_confirmed";
  const isInHotelBalance = isBalanceMethodInStructure(confirmation?.selectedBalanceMethod);
  const selectedPrice = defaultSelectedPrice;
  const depositAmount = confirmation?.selectedDepositAmount;
  const balanceAmount = confirmation?.selectedBalanceAmount;
  const balanceSchedule = getBalancePaymentSchedule(confirmation?.selectedBalanceMethod, quote.arrivalDate);
  const parsedNewTotalPrice = Number(newTotalPrice);
  const parsedNewDepositAmount = Number(newDepositAmount);
  const editedBalanceAmount = Number.isFinite(parsedNewTotalPrice) && Number.isFinite(parsedNewDepositAmount)
    ? parsedNewTotalPrice - parsedNewDepositAmount
    : 0;

  const finalPaymentSnapshot = confirmation?.finalConfirmationSentAt ? confirmation?.paymentSettingsSnapshot ?? {} : {};
  const finalPaymentReason = typeof finalPaymentSnapshot.payment_reason === "string" ? finalPaymentSnapshot.payment_reason : "";
  const hasFinalCoordinates = finalPaymentSnapshot.configured === true;
  const hasCurrentCoordinates = isPaymentSettingsConfigured(paymentSettings);
  const confirmationChildren = getConfirmationChildren(confirmation?.metadata, quote.children);
  const additionalServices = getConfirmationAdditionalServices(confirmation?.metadata);
  const confirmationName = `${confirmation?.firstName ?? quote.customerFirstName} ${confirmation?.lastName ?? quote.customerLastName}`.trim();
  const addressLine = [confirmation?.address, confirmation?.zip, confirmation?.city, confirmation?.province].filter(Boolean).join(" ");
  const currentPaymentReason = buildPaymentReason(
    paymentSettings,
    quote.code,
    confirmation?.firstName ?? quote.customerFirstName,
    confirmation?.lastName ?? quote.customerLastName
  );

  const depositDueIso = useMemo(() => {
    const parsed = new Date(depositDueAt);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  }, [depositDueAt]);

  const finalDepositAmount = Number(depositAmountOverride);
  const finalBalanceAmount = isInHotelBalance
    ? (Number.isFinite(finalDepositAmount) && finalDepositAmount > 0 ? selectedPrice - finalDepositAmount : 0)
    : Number(balanceAmountOverride);

  useEffect(() => {
    setServiceLabel("");
    setServiceCost("");
    setNewTotalPrice(formatAmountInput(defaultSelectedPrice));
    setNewDepositAmount(formatAmountInput(defaultDepositAmount));
    setTotalManuallyEdited(false);
    setVoucherNotes(confirmation?.voucherNotes ?? "");
    setDepositDueAt(confirmationDepositDueLocalInput(confirmation?.depositDueAt));
    setDepositAmountOverride(formatAmountInput(defaultDepositAmount));
    setBalanceAmountOverride("");
    setCustomerFirstName(confirmation?.firstName ?? quote.customerFirstName);
    setCustomerLastName(confirmation?.lastName ?? quote.customerLastName);
    setCustomerEmail(confirmation?.email ?? quote.customerEmail);
    setCustomerPhone(confirmation?.phone ?? quote.customerPhone);
  }, [
    confirmationId,
    confirmation?.voucherNotes,
    confirmation?.depositDueAt,
    confirmation?.firstName,
    confirmation?.lastName,
    confirmation?.email,
    confirmation?.phone,
    quote.customerFirstName,
    quote.customerLastName,
    quote.customerEmail,
    quote.customerPhone,
    defaultSelectedPrice,
    defaultDepositAmount
  ]);

  const depositCoordinatesWhatsapp = useMemo(() => {
    if (!hasCurrentCoordinates || depositAmount == null) return null;
    const message = depositCoordinatesWhatsappMessage({
      firstName: confirmation?.firstName ?? quote.customerFirstName,
      code: quote.code,
      hotelName: confirmation?.selectedHotelName ?? quote.proposedHotel.name,
      treatmentLabel: confirmation?.selectedTreatmentLabel ?? quote.treatment,
      priceLabel: formatCurrency(selectedPrice),
      depositLabel: formatCurrency(depositAmount),
      balanceLabel: balanceAmount != null ? formatCurrency(balanceAmount) : undefined,
      depositDueLabel: depositDueIso ? formatDateTime(depositDueIso) : undefined,
      bankAccountHolder: paymentSettings.bankAccountHolder,
      bankName: paymentSettings.bankName || undefined,
      iban: paymentSettings.iban,
      bicSwift: paymentSettings.bicSwift || undefined,
      paymentReason: currentPaymentReason,
      paymentInstructions: paymentSettings.paymentInstructions || undefined
    });
    const phone = confirmation?.phone ?? quote.customerPhone;
    return { message, chatUrl: `https://wa.me/${normalizeItalianPhone(phone)}` };
  }, [hasCurrentCoordinates, depositAmount, balanceAmount, confirmation, quote, selectedPrice, depositDueIso, paymentSettings, currentPaymentReason]);

  async function handleSendDepositCoordinatesWhatsapp() {
    if (!depositCoordinatesWhatsapp) return;
    await navigator.clipboard.writeText(depositCoordinatesWhatsapp.message).catch(() => null);
    setDepositCoordinatesCopied(true);
    setTimeout(() => setDepositCoordinatesCopied(false), 3000);
    window.open(depositCoordinatesWhatsapp.chatUrl, "_blank", "noopener,noreferrer");
  }

  async function handleSendVoucherWhatsapp() {
    setLoadingAction("voucher-whatsapp");
    setMessage(null);

    const response = await adminApiFetch(`/api/quote-confirmations/${confirmationId}/voucher-preview`, {
      method: "GET"
    });
    if (!response.ok) {
      const result = await readAdminApiJson<{ error?: string }>(response);
      setLoadingAction(null);
      setMessage(adminApiErrorMessage(response, result, "Non è stato possibile preparare il voucher."));
      return;
    }

    const voucherBlob = await response.blob();
    const voucherFile = new File([voucherBlob], `voucher-${quote.code}.pdf`, { type: "application/pdf" });
    const firstName = confirmation?.firstName ?? quote.customerFirstName;
    const whatsappMessage = `Ciao ${firstName}, ti invio il voucher della prenotazione ${quote.code}.`;

    if (navigator.canShare?.({ files: [voucherFile] })) {
      try {
        await navigator.share({
          files: [voucherFile],
          title: `Voucher ${quote.code}`,
          text: whatsappMessage
        });
        setMessage("Voucher condiviso.");
        setLoadingAction(null);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setLoadingAction(null);
          return;
        }
      }
    }

    const downloadUrl = URL.createObjectURL(voucherBlob);
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;
    downloadLink.download = voucherFile.name;
    downloadLink.click();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

    await navigator.clipboard.writeText(whatsappMessage).catch(() => null);
    const phone = confirmation?.phone ?? quote.customerPhone;
    window.open(`https://wa.me/${normalizeItalianPhone(phone)}?text=${encodeURIComponent(whatsappMessage)}`, "_blank", "noopener,noreferrer");
    setMessage("Voucher scaricato e chat WhatsApp aperta. Allega il PDF appena scaricato.");
    setLoadingAction(null);
  }

  useEffect(() => {
    if (!confirmationId || status !== "availability_confirmed" || !featureFlags.supplier_confirmation) return;
    let cancelled = false;
    void (async () => {
      const response = await adminApiFetch(`/api/quote-confirmations/${confirmationId}/send-supplier-confirmation`, {
        method: "GET",
        headers: adminApiHeaders()
      });
      const result = await readAdminApiJson<{ ok?: boolean; lastSent?: { recipientEmail: string; sentAt: string } | null }>(response);
      if (!cancelled && result?.ok && result.lastSent) {
        setSupplierSentInfo({ email: result.lastSent.recipientEmail, sentAt: result.lastSent.sentAt });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [confirmationId, status, featureFlags.supplier_confirmation]);

  if (!confirmation || !confirmationId) return null;

  function openSupplierModal() {
    setSupplierError(null);
    setShowSupplierModal(true);
  }

  async function submitSupplierConfirmation() {
    setSupplierError(null);
    const netPriceValue = Number(supplierNetPrice);
    if (!supplierRecipientEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supplierRecipientEmail.trim())) {
      setSupplierError("Inserisci un indirizzo email valido.");
      return;
    }
    if (!Number.isFinite(netPriceValue) || netPriceValue <= 0) {
      setSupplierError("Inserisci un prezzo netto valido.");
      return;
    }

    setSupplierSending(true);
    const response = await adminApiFetch(`/api/quote-confirmations/${confirmationId}/send-supplier-confirmation`, {
      method: "POST",
      headers: adminApiHeaders(),
      body: JSON.stringify({ recipientEmail: supplierRecipientEmail.trim(), netPrice: netPriceValue, notes: supplierNotes.trim() || undefined })
    });
    const result = await readAdminApiJson<{ success?: boolean; error?: string; sentAt?: string; recipientEmail?: string }>(response);
    setSupplierSending(false);

    if (!response.ok || !result?.success) {
      setSupplierError(adminApiErrorMessage(response, result));
      return;
    }

    setSupplierSentInfo({ email: result.recipientEmail ?? supplierRecipientEmail.trim(), sentAt: result.sentAt ?? new Date().toISOString() });
    setShowSupplierModal(false);
    setSupplierRecipientEmail("");
    setSupplierNetPrice("");
    setSupplierNotes("");
  }

  async function postAction(path: string, body: Record<string, unknown>, success: string) {
    setLoadingAction(path);
    setMessage(null);
    const response = await adminApiFetch(`/api/quote-confirmations/${confirmationId}/${path}`, {
      method: "POST",
      headers: adminApiHeaders(),
      body: JSON.stringify(body)
    });
    const result = await readAdminApiJson<VoucherEmailApiResult>(response);
    setLoadingAction(null);
    if (!response.ok || !result?.ok) {
      setMessage(adminApiErrorMessage(response, result));
      return;
    }
    setMessage(voucherAwareSuccessMessage(result, success));
    if (result.quote) onConfirmationUpdated?.(result.quote);
    router.refresh();
  }

  async function postDepositReceived(success: string) {
    setLoadingAction("deposit-received");
    setMessage(null);
    const response = await adminApiFetch(`/api/quote-confirmations/${confirmationId}/deposit-received`, {
      method: "POST",
      headers: adminApiHeaders(),
      body: JSON.stringify({})
    });
    const result = await readAdminApiJson<VoucherEmailApiResult>(response);
    setLoadingAction(null);
    if (!response.ok || !result?.success) {
      setMessage(adminApiErrorMessage(response, result));
      return;
    }
    setMessage(voucherAwareSuccessMessage(result, success));
    if (result.quote) onConfirmationUpdated?.(result.quote);
    router.refresh();
  }

  async function resendVoucherEmail() {
    setLoadingAction("send-voucher");
    setMessage(null);
    const response = await adminApiFetch(`/api/quote-confirmations/${confirmationId}/send-voucher`, {
      method: "POST",
      headers: adminApiHeaders(),
      body: JSON.stringify({})
    });
    const result = await readAdminApiJson<VoucherEmailApiResult>(response);
    setLoadingAction(null);
    if (!response.ok || !result?.ok) {
      setMessage(adminApiErrorMessage(response, result, "Invio voucher non riuscito. Puoi riprovare manualmente."));
      return;
    }
    setMessage("Voucher reinviato al cliente.");
    if (result.quote) onConfirmationUpdated?.(result.quote);
    router.refresh();
  }

  function updateServiceCost(value: string) {
    setServiceCost(value);
    if (totalManuallyEdited) return;

    const parsedServiceCost = Number(value);
    const nextTotal = defaultSelectedPrice + (Number.isFinite(parsedServiceCost) && value !== "" ? parsedServiceCost : 0);
    setNewTotalPrice(formatAmountInput(nextTotal));
  }

  function updateNewTotalPrice(value: string) {
    setTotalManuallyEdited(true);
    setNewTotalPrice(value);
  }

  async function patchAmounts() {
    const total = Number(newTotalPrice);
    const deposit = Number(newDepositAmount);
    const balance = total - deposit;

    if (!Number.isFinite(total) || total <= 0) {
      setMessage("Inserisci un nuovo totale valido.");
      return;
    }
    if (!Number.isFinite(deposit) || deposit <= 0) {
      setMessage("Inserisci una caparra valida.");
      return;
    }
    if (balance < 0) {
      setMessage("La caparra non può superare il nuovo totale.");
      return;
    }

    setLoadingAction("update-amounts");
    setMessage(null);
    const response = await adminApiFetch(`/api/quote-confirmations/${confirmationId}/update-amounts`, {
      method: "PATCH",
      headers: adminApiHeaders(),
      body: JSON.stringify({
        newTotalPrice: total,
        depositAmount: deposit,
        balanceAmount: balance,
        serviceLabel: serviceLabel.trim() || undefined,
        serviceCost: serviceCost ? Number(serviceCost) : undefined
      })
    });
    const result = await readAdminApiJson<{ success?: boolean; error?: string; quote?: Quote }>(response);
    setLoadingAction(null);
    if (!response.ok || !result?.success) {
      setMessage(adminApiErrorMessage(response, result));
      return;
    }

    setMessage("\u2713 Importi aggiornati");
    if (result.quote) onConfirmationUpdated?.(result.quote);
    setServiceLabel("");
    setServiceCost("");
    setTotalManuallyEdited(false);
    router.refresh();
  }

  async function removeAdditionalService(index: number) {
    const service = additionalServices[index];
    if (!service) return;

    const costMessage = service.cost != null
      ? ` Verranno sottratti ${formatCurrency(service.cost)} dal totale.`
      : " Il totale resterà invariato perché per questo servizio non è stato registrato un costo.";
    if (!window.confirm(`Vuoi rimuovere "${service.label}"?${costMessage}`)) return;

    setLoadingAction(`remove-service-${index}`);
    setMessage(null);
    const response = await adminApiFetch(`/api/quote-confirmations/${confirmationId}/update-amounts`, {
      method: "PATCH",
      headers: adminApiHeaders(),
      body: JSON.stringify({ removeServiceIndex: index })
    });
    const result = await readAdminApiJson<{
      success?: boolean;
      error?: string;
      quote?: Quote;
      totalAdjusted?: boolean;
    }>(response);
    setLoadingAction(null);
    if (!response.ok || !result?.success) {
      setMessage(adminApiErrorMessage(response, result));
      return;
    }

    setMessage(result.totalAdjusted
      ? `✓ ${service.label} rimosso e totale ricalcolato`
      : `✓ ${service.label} rimosso; totale invariato`);
    if (result.quote) onConfirmationUpdated?.(result.quote);
    router.refresh();
  }

  async function patchVoucherNotes() {
    setLoadingAction("voucher-notes");
    setMessage(null);
    const response = await adminApiFetch(`/api/quote-confirmations/${confirmationId}/voucher-notes`, {
      method: "PATCH",
      headers: adminApiHeaders(),
      body: JSON.stringify({ voucherNotes })
    });
    const result = await readAdminApiJson<{ success?: boolean; error?: string; quote?: Quote }>(response);
    setLoadingAction(null);
    if (!response.ok || !result?.success) {
      setMessage(adminApiErrorMessage(response, result));
      return;
    }

    setMessage("Note voucher salvate.");
    if (result.quote) onConfirmationUpdated?.(result.quote);
    router.refresh();
  }

  async function patchCustomerDetails() {
    if (!customerFirstName.trim() || !customerLastName.trim() || !customerEmail.trim() || !customerPhone.trim()) {
      setMessage("Compila nome, cognome, email e telefono.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
      setMessage("Inserisci un indirizzo email valido.");
      return;
    }

    setLoadingAction("customer-details");
    setMessage(null);
    const response = await adminApiFetch(`/api/quote-confirmations/${confirmationId}/customer-details`, {
      method: "PATCH",
      headers: adminApiHeaders(),
      body: JSON.stringify({
        firstName: customerFirstName,
        lastName: customerLastName,
        email: customerEmail,
        phone: customerPhone
      })
    });
    const result = await readAdminApiJson<{ success?: boolean; error?: string; quote?: Quote }>(response);
    setLoadingAction(null);
    if (!response.ok || !result?.success) {
      setMessage(adminApiErrorMessage(response, result));
      return;
    }

    setMessage("Dati cliente aggiornati.");
    setEditingCustomerDetails(false);
    if (result.quote) onConfirmationUpdated?.(result.quote);
    router.refresh();
  }

  function cancelCustomerDetailsEditing() {
    setCustomerFirstName(confirmation?.firstName ?? quote.customerFirstName);
    setCustomerLastName(confirmation?.lastName ?? quote.customerLastName);
    setCustomerEmail(confirmation?.email ?? quote.customerEmail);
    setCustomerPhone(confirmation?.phone ?? quote.customerPhone);
    setEditingCustomerDetails(false);
  }

  return (
    <section id="verifica-disponibilita" className="rounded-2xl bg-white/90 p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-ischia-navy">{isManualEmailImport ? "Prenotazione importata via email" : "Verifica disponibilità struttura"}</h2>
          <p className="mt-1 text-sm text-ischia-ink/65">
            {isManualEmailImport ? "Conferma registrata manualmente dall'operatore e pronta per il voucher." : "La conferma cliente non è ancora prenotazione definitiva."}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${(confirmation?.depositPaidAt || confirmation?.balancePaidAt) ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-ischia-mist text-ischia-navy ring-ischia-blue/15"}`}>
          {confirmation?.balancePaidAt ? "✓ Saldo ricevuto" : confirmation?.depositPaidAt ? "✓ Caparra ricevuta" : availabilityStatusLabel(status)}
        </span>
      </div>

      {message ? <p className="mt-3 rounded-xl bg-ischia-mist p-3 text-sm font-bold text-ischia-navy">{message}</p> : null}

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Info label="Nome cliente" value={confirmationName || "-"} />
        <Info label="Telefono" value={confirmation.phone ?? quote.customerPhone ?? "-"} />
        <Info label="Email" value={confirmation.email ?? quote.customerEmail ?? "-"} />
        <Info label="Codice fiscale" value={confirmation.fiscalCode || "-"} />
        <Info label="Indirizzo" value={addressLine || "-"} />
        <Info label="Bambini / età" value={confirmationChildren} />
        <Info label="Hotel scelto" value={confirmation.selectedHotelName ?? quote.proposedHotel.name} />
        <Info label="Trattamento" value={confirmation.selectedTreatmentLabel ?? (quote.treatment || "-")} />
        <Info label="Prezzo" value={selectedPrice > 0 ? formatCurrency(selectedPrice) : "-"} />
        <Info label="Caparra" value={depositAmount != null ? formatCurrency(depositAmount) : "-"} />
        <Info label="Saldo" value={balanceAmount != null ? formatCurrency(balanceAmount) : "-"} />
        <Info label="Modalità saldo" value={confirmation.selectedBalanceMethod ?? "-"} />
        {balanceSchedule.dueDate ? <Info label="Scadenza saldo" value={formatDate(balanceSchedule.dueDate)} /> : null}
        <Info label="Coordinate" value={hasCurrentCoordinates ? "Configurate per invio definitivo" : "Non configurate"} />
        <Info label="Causale" value={currentPaymentReason || "-"} />
        <Info label="Policy cancellazione" value={confirmation.selectedCancellationPolicy ?? quote.cancellationPolicy ?? "-"} />
        {additionalServices.length ? <Info label="Servizi aggiuntivi" value={additionalServices.map(formatConfirmationAdditionalService).join(" · ")} /> : null}
        <Info label="Confermata il" value={formatDateTime(confirmation.confirmedAt)} />
        <Info label="Date" value={`${formatDate(quote.arrivalDate)} - ${formatDate(quote.departureDate)}`} />
      </div>

      <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-[#1B3A5C]/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-black text-ischia-navy">Dati cliente</h3>
            <p className="mt-1 text-sm text-ischia-ink/65">Modifica i contatti usati per email, WhatsApp e voucher.</p>
          </div>
          {!editingCustomerDetails ? (
            <button
              className="rounded-full border border-[#1B3A5C] bg-white px-4 py-2 text-sm font-black text-[#1B3A5C] hover:bg-[#EFF6FF] disabled:opacity-60"
              disabled={Boolean(loadingAction)}
              onClick={() => setEditingCustomerDetails(true)}
              type="button"
            >
              Modifica dati cliente
            </button>
          ) : null}
        </div>
        {editingCustomerDetails ? (
          <>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <CustomerInput label="Nome" value={customerFirstName} onChange={setCustomerFirstName} />
              <CustomerInput label="Cognome" value={customerLastName} onChange={setCustomerLastName} />
              <CustomerInput label="Email" type="email" value={customerEmail} onChange={setCustomerEmail} />
              <CustomerInput label="Telefono" type="tel" value={customerPhone} onChange={setCustomerPhone} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded-full bg-ischia-navy px-4 py-2 text-sm font-black text-white disabled:opacity-60"
                disabled={Boolean(loadingAction)}
                onClick={() => void patchCustomerDetails()}
                type="button"
              >
                {loadingAction === "customer-details" ? "Salvataggio..." : "Salva dati cliente"}
              </button>
              <button
                className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ischia-navy ring-1 ring-ischia-blue/20 disabled:opacity-60"
                disabled={Boolean(loadingAction)}
                onClick={cancelCustomerDetailsEditing}
                type="button"
              >
                Annulla
              </button>
            </div>
          </>
        ) : null}
      </div>

      <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-[#1B3A5C]/20">
        <h3 className="font-black text-ischia-navy">Modifica importi</h3>
        <p className="mt-1 text-sm text-ischia-ink/65">Aggiungi un servizio extra o modifica manualmente totale e caparra.</p>
        {additionalServices.length ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-ischia-blue/75">Servizi aggiunti</p>
            {additionalServices.map((service, index) => (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ischia-mist px-3 py-2" key={`${service.label}-${service.cost ?? "no-cost"}-${index}`}>
                <span className="text-sm font-bold text-ischia-navy">{formatConfirmationAdditionalService(service)}</span>
                <button
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-rose-700 ring-1 ring-rose-200 disabled:opacity-60"
                  disabled={Boolean(loadingAction)}
                  onClick={() => void removeAdditionalService(index)}
                  type="button"
                >
                  {loadingAction === `remove-service-${index}` ? "Rimozione..." : "Rimuovi"}
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold text-ischia-ink">
            Servizio aggiuntivo
            <input
              className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2"
              placeholder="Es. Trasporto porto, Transfer aeroporto"
              type="text"
              value={serviceLabel}
              onChange={(event) => setServiceLabel(event.target.value)}
            />
          </label>
          <label className="text-sm font-semibold text-ischia-ink">
            Costo aggiuntivo (&euro;)
            <input
              className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2"
              min="0"
              step="0.01"
              type="number"
              value={serviceCost}
              onChange={(event) => updateServiceCost(event.target.value)}
            />
          </label>
          <label className="text-sm font-semibold text-ischia-ink">
            Nuovo totale (&euro;)
            <input
              className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2"
              min="0"
              step="0.01"
              type="number"
              value={newTotalPrice}
              onChange={(event) => updateNewTotalPrice(event.target.value)}
            />
          </label>
          <label className="text-sm font-semibold text-ischia-ink">
            Caparra (&euro;)
            <input
              className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2"
              min="0"
              step="0.01"
              type="number"
              value={newDepositAmount}
              onChange={(event) => setNewDepositAmount(event.target.value)}
            />
          </label>
          <label className="text-sm font-semibold text-ischia-ink">
            Saldo (&euro;)
            <input
              className="mt-1 w-full rounded-xl border border-ischia-blue/20 bg-ischia-mist px-3 py-2 font-bold text-ischia-navy"
              readOnly
              type="number"
              value={formatAmountInput(editedBalanceAmount)}
            />
          </label>
        </div>
        <button
          className="mt-3 rounded-full border border-[#1B3A5C] bg-white px-4 py-2 text-sm font-black text-[#1B3A5C] hover:bg-[#EFF6FF] disabled:opacity-60"
          disabled={Boolean(loadingAction)}
          onClick={() => void patchAmounts()}
          type="button"
        >
          Aggiorna importi
        </button>
        {confirmation.finalConfirmationSentAt ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
            <p>{"\u26A0\uFE0F La conferma definitiva \u00E8 gi\u00E0 stata inviata. Ricorda di reinviarla al cliente con i nuovi importi."}</p>
            <button
              className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#1B3A5C] ring-1 ring-[#1B3A5C]/30 hover:bg-[#EFF6FF] disabled:opacity-60"
              disabled={Boolean(loadingAction) || !depositDueIso || !hasCurrentCoordinates}
              onClick={() => void postAction("send-final-confirmation", { depositDueAt: depositDueIso, notes: finalNotes, ...(Number(depositAmountOverride) > 0 ? { depositAmountOverride: Number(depositAmountOverride) } : {}), ...(finalBalanceAmount > 0 ? { balanceAmountOverride: finalBalanceAmount } : {}) }, "Conferma definitiva reinviata al cliente.")}
              type="button"
            >
              Reinvia conferma al cliente
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl bg-ischia-mist p-4 text-sm text-ischia-ink">
        <h3 className="font-black text-ischia-navy">Coordinate pagamento</h3>
        {hasFinalCoordinates ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Info label="Snapshot inviato" value="Coordinate salvate nella conferma definitiva" />
            <Info label="Intestatario" value={String(finalPaymentSnapshot.bank_account_holder ?? "-")} />
            <Info label="Banca" value={String(finalPaymentSnapshot.bank_name ?? "-")} />
            <Info label="IBAN" value={String(finalPaymentSnapshot.iban ?? "-")} />
            <Info label="BIC/SWIFT" value={String(finalPaymentSnapshot.bic_swift ?? "-")} />
            <Info label="Causale" value={finalPaymentReason || "-"} />
          </div>
        ) : hasCurrentCoordinates ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Info label="Intestatario" value={paymentSettings.bankAccountHolder || "-"} />
            <Info label="Banca" value={paymentSettings.bankName || "-"} />
            <Info label="IBAN" value={paymentSettings.iban || "-"} />
            <Info label="BIC/SWIFT" value={paymentSettings.bicSwift || "-"} />
            <Info label="Causale" value={currentPaymentReason || "-"} />
            <Info label="Istruzioni" value={paymentSettings.paymentInstructions || "-"} />
          </div>
        ) : (
          <p className="mt-2 font-semibold text-amber-800">Coordinate pagamento non configurate. Vai in Impostazioni.</p>
        )}
      </div>

      {!confirmation?.finalConfirmationSentAt ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="rounded-full bg-ischia-leaf px-4 py-2 text-sm font-black text-white disabled:opacity-60"
            disabled={Boolean(loadingAction)}
            onClick={() => void postAction("availability-confirmed", {}, "Disponibilità struttura confermata.")}
            type="button"
          >
            Disponibilità confermata
          </button>
          <button
            className="rounded-full bg-rose-50 px-4 py-2 text-sm font-black text-rose-700 ring-1 ring-rose-100 disabled:opacity-60"
            disabled={Boolean(loadingAction)}
            onClick={() => void postAction("availability-unavailable", { reason: unavailableReason, alternativeToPropose }, "Disponibilità segnata come terminata.")}
            type="button"
          >
            Disponibilità terminata
          </button>
        </div>
      ) : null}

      {canSendFinal ? (
        <div className="mt-5 rounded-2xl bg-emerald-50/60 p-4 ring-1 ring-emerald-200/70">
          <h3 className="font-black text-ischia-navy">Invia conferma definitiva al cliente</h3>
          {!hasCurrentCoordinates ? (
            <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
              Coordinate pagamento non configurate. Vai in Impostazioni.
            </p>
          ) : null}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-ischia-ink">
              Scadenza caparra
              <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" type="datetime-local" value={depositDueAt} onChange={(event) => setDepositDueAt(event.target.value)} />
            </label>
            <label className="text-sm font-semibold text-ischia-ink">
              Importo caparra (&euro;)
              <input
                className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2"
                type="number"
                min="0"
                step="0.01"
                placeholder="es. 300"
                value={depositAmountOverride}
                onChange={(event) => setDepositAmountOverride(event.target.value)}
              />
            </label>
            <label className="text-sm font-semibold text-ischia-ink">
              Saldo (&euro;){isInHotelBalance ? " — calcolato automaticamente" : ""}
              <input
                className={`mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2 ${isInHotelBalance ? "bg-ischia-mist font-bold text-ischia-navy" : ""}`}
                type="number"
                min="0"
                step="0.01"
                readOnly={isInHotelBalance}
                value={isInHotelBalance ? formatAmountInput(finalBalanceAmount > 0 ? finalBalanceAmount : 0) : balanceAmountOverride}
                onChange={isInHotelBalance ? undefined : (event) => setBalanceAmountOverride(event.target.value)}
              />
            </label>
            <label className="text-sm font-semibold text-ischia-ink">
              Totale: {formatCurrency(selectedPrice)}
              <span className="mt-1 block text-xs font-normal text-ischia-ink/65">Modalità saldo: {confirmation?.selectedBalanceMethod ?? "-"}</span>
            </label>
            <label className="text-sm font-semibold text-ischia-ink sm:col-span-2">
              Note per il cliente
              <textarea className="mt-1 min-h-20 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={finalNotes} onChange={(event) => setFinalNotes(event.target.value)} />
            </label>
          </div>
          <div className="mt-3 rounded-xl bg-white p-3 text-sm text-ischia-ink/75 ring-1 ring-emerald-200/60">
            {hasCurrentCoordinates ? (
              <>
                <p><strong>Coordinate che verranno inviate:</strong> {paymentSettings.bankAccountHolder} · {paymentSettings.iban}</p>
                {paymentSettings.bankName ? <p><strong>Banca:</strong> {paymentSettings.bankName}</p> : null}
                {paymentSettings.bicSwift ? <p><strong>BIC/SWIFT:</strong> {paymentSettings.bicSwift}</p> : null}
                <p><strong>Causale:</strong> {currentPaymentReason}</p>
                {paymentSettings.paymentInstructions ? <p><strong>Istruzioni:</strong> {paymentSettings.paymentInstructions}</p> : null}
              </>
            ) : (
              <p className="font-semibold text-amber-800">Coordinate pagamento non configurate. Completa le impostazioni prima di inviare la conferma definitiva.</p>
            )}
          </div>
          {confirmation?.finalConfirmationSentAt ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="rounded-xl bg-emerald-100 px-3 py-2 text-sm font-black text-emerald-800">
                ✓ Conferma inviata il {formatDateTime(confirmation.finalConfirmationSentAt)}
              </p>
              <button
                className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ischia-navy ring-1 ring-ischia-blue/20 disabled:opacity-60"
                disabled={Boolean(loadingAction) || !depositDueIso || !hasCurrentCoordinates}
                onClick={() => void postAction("send-final-confirmation", { depositDueAt: depositDueIso, notes: finalNotes, ...(Number(depositAmountOverride) > 0 ? { depositAmountOverride: Number(depositAmountOverride) } : {}), ...(finalBalanceAmount > 0 ? { balanceAmountOverride: finalBalanceAmount } : {}) }, "Conferma definitiva reinviata al cliente.")}
                type="button"
              >
                Reinvia conferma al cliente
              </button>
            </div>
          ) : (
            <button
              className="mt-3 rounded-full bg-ischia-navy px-4 py-2 text-sm font-black text-white disabled:opacity-60"
              disabled={Boolean(loadingAction) || !depositDueIso || !hasCurrentCoordinates}
              onClick={() => void postAction("send-final-confirmation", { depositDueAt: depositDueIso, notes: finalNotes, ...(Number(depositAmountOverride) > 0 ? { depositAmountOverride: Number(depositAmountOverride) } : {}), ...(finalBalanceAmount > 0 ? { balanceAmountOverride: finalBalanceAmount } : {}) }, "Conferma definitiva inviata al cliente.")}
              type="button"
            >
              Invia conferma definitiva al cliente
            </button>
          )}

        </div>
      ) : null}

      {(status === "availability_confirmed" || status === "deposit_waiting") && depositCoordinatesWhatsapp ? (
        <button
          className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-ischia-leaf px-4 py-2 text-sm font-black text-white"
          onClick={() => void handleSendDepositCoordinatesWhatsapp()}
          type="button"
        >
          {depositCoordinatesCopied ? "✓ Testo copiato — incolla su WhatsApp" : "📲 Invia coordinate acconto su WhatsApp"}
        </button>
      ) : null}

      {status === "availability_confirmed" && featureFlags.supplier_confirmation ? (
        <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-ischia-blue/15">
          <h3 className="font-black text-ischia-navy">Conferma a hotel / agenzia</h3>
          <p className="mt-1 text-sm text-ischia-ink/65">Invia una email di conferma prenotazione al fornitore, con il prezzo netto concordato (non visibile al cliente).</p>
          {supplierSentInfo ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="rounded-xl bg-ischia-mist px-3 py-2 text-sm font-black text-ischia-navy">
                ✓ Conferma inviata a {supplierSentInfo.email} il {formatDateTime(supplierSentInfo.sentAt)}
              </p>
              <button
                className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#1B3A5C] ring-1 ring-[#1B3A5C]/30 hover:bg-[#EFF6FF] disabled:opacity-60"
                disabled={Boolean(loadingAction)}
                onClick={openSupplierModal}
                type="button"
              >
                Invia di nuovo
              </button>
            </div>
          ) : (
            <button
              className="mt-3 rounded-full border border-[#1B3A5C] bg-white px-4 py-2 text-sm font-black text-[#1B3A5C] hover:bg-[#EFF6FF] disabled:opacity-60"
              disabled={Boolean(loadingAction)}
              onClick={openSupplierModal}
              type="button"
            >
              Invia conferma a hotel/agenzia
            </button>
          )}
        </div>
      ) : null}

      {showSupplierModal && featureFlags.supplier_confirmation ? (
        <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5" role="dialog">
          <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-black text-ischia-navy">Invia conferma a hotel/agenzia</h3>
            <p className="mt-2 text-sm leading-6 text-gray-600">I dati del cliente e del soggiorno verranno inclusi automaticamente.</p>

            {supplierError ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700 ring-1 ring-rose-100">{supplierError}</p> : null}

            <div className="mt-4 space-y-3">
              <label className="block text-sm font-semibold text-ischia-ink">
                Email hotel o agenzia
                <input
                  className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2"
                  placeholder="email@hotel.it"
                  type="email"
                  value={supplierRecipientEmail}
                  onChange={(event) => setSupplierRecipientEmail(event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold text-ischia-ink">
                Prezzo netto (visibile solo al fornitore)
                <input
                  className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2"
                  placeholder="es. 1200"
                  type="number"
                  value={supplierNetPrice}
                  onChange={(event) => setSupplierNetPrice(event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold text-ischia-ink">
                Note aggiuntive
                <textarea
                  className="mt-1 min-h-16 w-full rounded-xl border border-ischia-blue/20 px-3 py-2"
                  placeholder="Es. camera vista mare, culla aggiuntiva..."
                  value={supplierNotes}
                  onChange={(event) => setSupplierNotes(event.target.value)}
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                className="rounded-full bg-white px-4 py-2 text-sm font-bold text-ischia-navy ring-1 ring-ischia-blue/20"
                disabled={supplierSending}
                onClick={() => setShowSupplierModal(false)}
                type="button"
              >
                Annulla
              </button>
              <button
                className="rounded-full bg-[#1B3A5C] px-4 py-2 text-sm font-black text-white disabled:opacity-60"
                disabled={supplierSending}
                onClick={() => void submitSupplierConfirmation()}
                type="button"
              >
                {supplierSending ? "Invio in corso…" : "Invia conferma"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {status === "deposit_waiting" ? (
        <div className="mt-5 rounded-2xl bg-amber-50/60 p-4 ring-1 ring-amber-200/70">
          <h3 className="font-black text-ischia-navy">Caparra e voucher cliente</h3>
          <label className="mt-3 block text-sm font-semibold text-ischia-ink">
            Note voucher
            <textarea
              className="mt-1 min-h-20 w-full rounded-xl border border-ischia-blue/20 bg-white px-3 py-2"
              maxLength={500}
              placeholder="Scrivi eventuali note da mostrare nel voucher…"
              value={voucherNotes}
              onChange={(event) => setVoucherNotes(event.target.value)}
            />
            <span className="mt-1 block text-xs font-normal text-ischia-ink/65">Queste note compariranno nel voucher inviato al cliente.</span>
          </label>
          <button
            className="mt-3 rounded-full border border-[#1B3A5C] bg-white px-4 py-2 text-sm font-black text-[#1B3A5C] hover:bg-[#EFF6FF] disabled:opacity-60"
            disabled={Boolean(loadingAction)}
            onClick={() => void patchVoucherNotes()}
            type="button"
          >
            Salva note voucher
          </button>
          {confirmation.depositPaidAt ? (
            <button
              className="ml-3 mt-3 rounded-full border border-[#16A34A] bg-white px-4 py-2 text-sm font-black text-[#15803D] hover:bg-emerald-50 disabled:opacity-60"
              disabled={Boolean(loadingAction)}
              onClick={() => void handleSendVoucherWhatsapp()}
              type="button"
            >
              {loadingAction === "voucher-whatsapp" ? "Preparo il voucher..." : "Invia voucher su WhatsApp"}
            </button>
          ) : null}
          {confirmation.depositPaidAt ? (
            isInHotelBalance ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <p className="rounded-xl bg-emerald-100 px-3 py-2 text-sm font-black text-emerald-800">
                  ✓ Caparra ricevuta il {formatDateTime(confirmation.depositPaidAt)}
                </p>
                <a
                  className="rounded-full bg-ischia-mist px-3 py-1.5 text-xs font-bold text-ischia-navy ring-1 ring-ischia-blue/20"
                  href={`/api/quote-confirmations/${confirmationId}/voucher-preview`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Anteprima voucher
                </a>
                <button
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ischia-navy ring-1 ring-ischia-blue/20 disabled:opacity-60"
                  disabled={Boolean(loadingAction)}
                  onClick={() => void resendVoucherEmail()}
                  type="button"
                >
                  Invia voucher di nuovo
                </button>
              </div>
            ) : confirmation.balancePaidAt ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <p className="rounded-xl bg-emerald-100 px-3 py-2 text-sm font-black text-emerald-800">
                  ✓ Caparra ricevuta il {formatDateTime(confirmation.depositPaidAt)}
                </p>
                <p className="rounded-xl bg-emerald-100 px-3 py-2 text-sm font-black text-emerald-800">
                  ✓ Saldo ricevuto il {formatDateTime(confirmation.balancePaidAt)}
                </p>
                <a
                  className="rounded-full bg-ischia-mist px-3 py-1.5 text-xs font-bold text-ischia-navy ring-1 ring-ischia-blue/20"
                  href={`/api/quote-confirmations/${confirmationId}/voucher-preview`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Anteprima voucher
                </a>
                <button
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ischia-navy ring-1 ring-ischia-blue/20 disabled:opacity-60"
                  disabled={Boolean(loadingAction)}
                  onClick={() => void resendVoucherEmail()}
                  type="button"
                >
                  Invia voucher di nuovo
                </button>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <p className="rounded-xl bg-emerald-100 px-3 py-2 text-sm font-black text-emerald-800">
                  ✓ Caparra ricevuta il {formatDateTime(confirmation.depositPaidAt)}
                </p>
                <button
                  className="rounded-full px-4 py-2 text-sm font-black text-white disabled:opacity-60"
                  style={{ backgroundColor: "#16A34A" }}
                  disabled={Boolean(loadingAction)}
                  onClick={() => void postAction("balance-received", {}, "Saldo registrato e voucher inviato al cliente.")}
                  type="button"
                >
                  Saldo ricevuto
                </button>
              </div>
            )
          ) : (
            <button
              className="mt-3 rounded-full px-4 py-2 text-sm font-black text-white disabled:opacity-60"
              style={{ backgroundColor: "#16A34A" }}
              disabled={Boolean(loadingAction)}
              onClick={() => void postDepositReceived("Caparra registrata e voucher inviato al cliente.")}
              type="button"
            >
              Caparra ricevuta
            </button>
          )}
        </div>
      ) : null}

      <div className="mt-5 rounded-2xl bg-rose-50/70 p-4 ring-1 ring-rose-100">
        <h3 className="font-black text-ischia-navy">Comunica disponibilità terminata al cliente</h3>
        <label className="mt-3 block text-sm font-semibold text-ischia-ink">
          Motivo / nota
          <input className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={unavailableReason} onChange={(event) => setUnavailableReason(event.target.value)} />
        </label>
        <label className="mt-3 block text-sm font-semibold text-ischia-ink">
          Testo email
          <textarea className="mt-1 min-h-52 w-full rounded-xl border border-ischia-blue/20 px-3 py-2" value={unavailableMessage} onChange={(event) => setUnavailableMessage(event.target.value)} />
        </label>
        <label className="mt-3 flex gap-3 text-sm font-semibold text-ischia-ink">
          <input checked={alternativeToPropose} className="mt-1 h-4 w-4" onChange={(event) => setAlternativeToPropose(event.target.checked)} type="checkbox" />
          Segna come alternativa da proporre
        </label>
        <button
          className="mt-3 rounded-full bg-rose-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
          disabled={Boolean(loadingAction) || !unavailableMessage.trim()}
          onClick={() => void postAction("send-unavailability-email", { reason: unavailableReason, message: unavailableMessage, alternativeToPropose }, "Email disponibilità terminata inviata.")}
          type="button"
        >
          Invia email disponibilità terminata
        </button>
      </div>
    </section>
  );
}

function formatAmountInput(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) return "";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function voucherAwareSuccessMessage(result: VoucherEmailApiResult | null, success: string) {
  if (result?.paymentSaved && result.voucherEmailSent === false) {
    return `${paymentSavedLabelFromSuccess(success)}, ma invio voucher non riuscito. Puoi reinviarlo manualmente.`;
  }
  return success;
}

function paymentSavedLabelFromSuccess(success: string) {
  return success.toLowerCase().includes("saldo") ? "Saldo registrato" : "Caparra registrata";
}

function confirmationDepositDueLocalInput(value: string | undefined) {
  if (!value) return formatDepositDueLocalInput();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? formatDepositDueLocalInput() : formatDepositDueLocalInput(date);
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ischia-mist p-3">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-ischia-blue/75">{label}</p>
      <p className="mt-1 font-semibold text-ischia-ink">{value}</p>
    </div>
  );
}

function CustomerInput({ label, type = "text", value, onChange }: { label: string; type?: "text" | "email" | "tel"; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-sm font-semibold text-ischia-ink">
      {label}
      <input
        className="mt-1 w-full rounded-xl border border-ischia-blue/20 px-3 py-2"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function getConfirmationChildren(metadata: Record<string, unknown> | undefined, fallbackChildren: { birthDate?: string }[]) {
  const metadataChildren = Array.isArray(metadata?.children) ? metadata.children : [];
  const children = metadataChildren.length ? metadataChildren : fallbackChildren;
  const labels = children
    .map((child, index) => {
      if (!child || typeof child !== "object") return null;
      const birthDate = "birthDate" in child && typeof child.birthDate === "string" ? child.birthDate : "";
      if (!birthDate) return null;
      return `Bambino ${index + 1}: ${birthDate}`;
    })
    .filter(Boolean);
  return labels.length ? labels.join(" · ") : "-";
}
