import path from "path";
import fs from "fs";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const NAVY = "#1B3A5C";
const NAVY_DARK = "#102A46";
const GOLD = "#C9A84C";
const GOLD_DARK = "#7A5C10";
const DARK = "#111827";
const GRAY = "#667085";
const BORDER = "#D9E2EC";
const SOFT_BG = "#F4F7FA";
const LIGHT_GOLD_BG = "#FFFBF0";
const GOLD_BORDER = "#E8D5A0";

const optimizedLogoPath = path.join(process.cwd(), "public", "ischiastars-logo-pdf.png");
const logoPath = fs.existsSync(optimizedLogoPath)
  ? optimizedLogoPath
  : path.join(process.cwd(), "public", "ischiastars-logo.png");
const logoSrc = fs.existsSync(logoPath)
  ? `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`
  : null;

const styles = StyleSheet.create({
  page: {
    padding: 0,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: DARK,
    backgroundColor: SOFT_BG,
  },
  header: {
    backgroundColor: NAVY,
    paddingHorizontal: 26,
    paddingTop: 15,
    paddingBottom: 16,
    borderBottomWidth: 3,
    borderBottomColor: GOLD,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandRow: {
    width: 130,
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 62,
    height: 62,
    objectFit: "contain",
  },
  brandFallback: {
    fontSize: 17,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: 0.7,
  },
  badge: {
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  badgeColumn: {
    width: 130,
    alignItems: "flex-end",
  },
  badgeText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
    letterSpacing: 1.3,
  },
  headerTitleColumn: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: 0.8,
    textAlign: "center",
  },
  headerCodeLabel: {
    fontSize: 6,
    color: "#AFC2D4",
    textAlign: "right",
    marginBottom: 2,
    letterSpacing: 0.7,
  },
  headerCode: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    textAlign: "right",
  },
  headerCodeBlock: {
    marginTop: 7,
    alignItems: "flex-end",
  },
  body: {
    paddingHorizontal: 26,
    paddingTop: 12,
    paddingBottom: 48,
  },
  hero: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderLeftWidth: 4,
    borderLeftColor: GOLD,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  eyebrow: {
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    color: GOLD_DARK,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  hotelName: {
    fontSize: 17,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 7,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  chip: {
    backgroundColor: "#EEF3F7",
    borderWidth: 1,
    borderColor: "#CCD8E3",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 5,
    marginBottom: 3,
  },
  chipGold: {
    backgroundColor: LIGHT_GOLD_BG,
    borderColor: GOLD_BORDER,
  },
  chipText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
  chipGoldText: {
    color: GOLD_DARK,
  },
  summaryRow: {
    flexDirection: "row",
  },
  summaryBox: {
    flex: 1,
    backgroundColor: NAVY,
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: 5,
  },
  summaryBoxLast: {
    marginRight: 0,
  },
  summaryBoxCompact: {
    flex: 0.62,
  },
  summaryLabel: {
    fontSize: 5.5,
    color: GOLD,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  contentRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  leftColumn: {
    width: "39%",
    marginRight: 8,
  },
  rightColumn: {
    flex: 1,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 7,
    padding: 10,
  },
  cardAccentNavy: {
    borderTopWidth: 3,
    borderTopColor: NAVY,
  },
  cardAccentGold: {
    borderTopWidth: 3,
    borderTopColor: GOLD,
  },
  sectionTitle: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    letterSpacing: 1,
    textTransform: "uppercase",
    paddingBottom: 5,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#E7ECF1",
  },
  dataRow: {
    marginBottom: 5,
  },
  dataLabel: {
    fontSize: 5.8,
    color: GRAY,
    marginBottom: 1,
  },
  dataValue: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: DARK,
  },
  servicesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  servicePill: {
    backgroundColor: "#F1F5F8",
    borderWidth: 1,
    borderColor: "#D3DEE8",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginRight: 4,
    marginBottom: 4,
  },
  serviceText: {
    fontSize: 6.6,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
  payment: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderLeftWidth: 4,
    borderLeftColor: NAVY,
    borderRadius: 7,
    padding: 10,
    marginBottom: 8,
  },
  paymentContent: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  paymentPaid: {
    flex: 1,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 5,
    padding: 8,
    marginRight: 7,
  },
  paymentBalance: {
    flex: 1,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    borderRadius: 5,
    padding: 8,
  },
  paymentEyebrow: {
    fontSize: 5.8,
    color: GRAY,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 3,
  },
  paidAmount: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#15803D",
    marginBottom: 2,
  },
  balanceAmount: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#B45309",
    marginBottom: 2,
  },
  paymentMeta: {
    fontSize: 6.2,
    color: GRAY,
  },
  notes: {
    backgroundColor: LIGHT_GOLD_BG,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    borderLeftWidth: 4,
    borderLeftColor: GOLD,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  notesTitle: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: GOLD_DARK,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  notesText: {
    fontSize: 6.8,
    color: "#6B4E00",
    lineHeight: 1.35,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 34,
    backgroundColor: NAVY_DARK,
    borderTopWidth: 2,
    borderTopColor: GOLD,
    paddingHorizontal: 26,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerBrand: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    marginBottom: 1,
  },
  footerContact: {
    fontSize: 6,
    color: "#AFC2D4",
  },
  footerCode: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
    textAlign: "right",
  },
});

export type VoucherDocumentData = {
  language?: "it" | "en";
  quoteCode: string;
  clientFullName: string;
  clientEmail?: string;
  clientPhone?: string;
  hotelName?: string;
  roomTypeLabel?: string;
  treatmentLabel?: string;
  arrivalDate?: string;
  departureDate?: string;
  nightsCount?: number;
  guestsLabel?: string;
  includedServices?: string[];
  depositAmountLabel: string;
  depositPaidAtLabel: string;
  balanceAmountLabel?: string;
  balanceTitleLabel?: string;
  balanceDueDateLabel?: string;
  balanceMethodLabel?: string;
  isBalancePaid?: boolean;
  isFullBalancePaid?: boolean;
  balancePaidAtLabel?: string;
  cancellationPolicy?: string;
  voucherNotes?: string;
  whatsappNumber: string;
};

function ClientDetail({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue}>{value}</Text>
    </View>
  );
}

export function VoucherDocument({ data }: { data: VoucherDocumentData }) {
  const en = data.language === "en";
  const v = (it: string, english: string) => en ? english : it;
  const services = (data.includedServices ?? []).filter(Boolean);
  const hasChips = Boolean(data.roomTypeLabel || data.treatmentLabel);
  const voucherNotes = data.voucherNotes?.trim();
  const cancellationPolicy = data.cancellationPolicy?.trim();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header} wrap={false}>
          <View style={styles.headerTopRow}>
            <View style={styles.brandRow}>
              {logoSrc ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={logoSrc} style={styles.logo} />
              ) : (
                <Text style={styles.brandFallback}>IschiaStars</Text>
              )}
            </View>
            <View style={styles.headerTitleColumn}>
              <Text style={styles.headerTitle}>{v('Voucher di Prenotazione','Booking Voucher')}</Text>
            </View>
            <View style={styles.badgeColumn}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{v('CONFERMATO','CONFIRMED')}</Text>
              </View>
            </View>
          </View>

          <View style={styles.headerCodeBlock}>
            <Text style={styles.headerCodeLabel}>{v('CODICE VOUCHER','VOUCHER CODE')}</Text>
            <Text style={styles.headerCode}>{data.quoteCode}-V</Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.hero} wrap={false}>
            <Text style={styles.eyebrow}>{v('IL TUO SOGGIORNO A ISCHIA','YOUR STAY IN ISCHIA')}</Text>
            {data.hotelName ? <Text style={styles.hotelName}>{data.hotelName}</Text> : null}

            {hasChips ? (
              <View style={styles.chipsRow}>
                {data.roomTypeLabel ? (
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{data.roomTypeLabel}</Text>
                  </View>
                ) : null}
                {data.treatmentLabel ? (
                  <View style={[styles.chip, styles.chipGold]}>
                    <Text style={[styles.chipText, styles.chipGoldText]}>{data.treatmentLabel}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.summaryRow}>
              {data.arrivalDate ? (
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLabel}>{v('Arrivo','Arrival')}</Text>
                  <Text style={styles.summaryValue}>{data.arrivalDate}</Text>
                </View>
              ) : null}
              {data.departureDate ? (
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLabel}>{v('Partenza','Departure')}</Text>
                  <Text style={styles.summaryValue}>{data.departureDate}</Text>
                </View>
              ) : null}
              {data.nightsCount ? (
                <View style={[styles.summaryBox, styles.summaryBoxCompact]}>
                  <Text style={styles.summaryLabel}>{v('Notti','Nights')}</Text>
                  <Text style={styles.summaryValue}>{data.nightsCount}</Text>
                </View>
              ) : null}
              {data.guestsLabel ? (
                <View style={[styles.summaryBox, styles.summaryBoxLast]}>
                  <Text style={styles.summaryLabel}>{v('Ospiti','Guests')}</Text>
                  <Text style={styles.summaryValue}>{data.guestsLabel}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.contentRow} wrap={false}>
            <View style={styles.leftColumn}>
              <View style={[styles.card, styles.cardAccentNavy]}>
                <Text style={styles.sectionTitle}>{v('Dati cliente','Guest details')}</Text>
                <ClientDetail label={v("Intestatario", "Lead guest")} value={data.clientFullName} />
                <ClientDetail label="Email" value={data.clientEmail} />
                <ClientDetail label={v("Telefono", "Phone")} value={data.clientPhone} />
              </View>
            </View>

            <View style={styles.rightColumn}>
              <View style={[styles.card, styles.cardAccentGold]}>
                <Text style={styles.sectionTitle}>{v('Servizi inclusi','Included services')}</Text>
                {services.length ? (
                  <View style={styles.servicesRow}>
                    {services.map((service, index) => (
                      <View key={index} style={styles.servicePill}>
                        <Text style={styles.serviceText}>{service}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.paymentMeta}>{v('Come indicato nella proposta confermata.','As stated in your confirmed proposal.')}</Text>
                )}
              </View>
            </View>
          </View>

          <View style={styles.payment} wrap={false}>
            <Text style={styles.sectionTitle}>{v('Riepilogo pagamento','Payment summary')}</Text>
            <View style={styles.paymentContent}>
              <View style={styles.paymentPaid}>
                <Text style={styles.paymentEyebrow}>{data.isFullBalancePaid ? v("Saldo versato", "Full payment received") : v("Caparra versata", "Deposit received")}</Text>
                <Text style={styles.paidAmount}>{data.depositAmountLabel}</Text>
                <Text style={styles.paymentMeta}>{v("Pagamento registrato il", "Payment recorded on")} {data.depositPaidAtLabel}</Text>
              </View>
              {!data.isFullBalancePaid && data.balanceAmountLabel ? (
                data.isBalancePaid ? (
                  <View style={styles.paymentPaid}>
                    <Text style={styles.paymentEyebrow}>{v('Saldo ricevuto','Balance received')}</Text>
                    <Text style={styles.paidAmount}>{data.balanceAmountLabel}</Text>
                    {data.balancePaidAtLabel ? (
                      <Text style={styles.paymentMeta}>{v("Pagamento registrato il", "Payment recorded on")} {data.balancePaidAtLabel}</Text>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.paymentBalance}>
                    <Text style={styles.paymentEyebrow}>{data.balanceTitleLabel ?? v("Saldo restante", "Remaining balance")}</Text>
                    <Text style={styles.balanceAmount}>{data.balanceAmountLabel}</Text>
                    {data.balanceDueDateLabel ? (
                      <Text style={styles.paymentMeta}>{v("Da versare entro il", "Due by")} {data.balanceDueDateLabel}</Text>
                    ) : null}
                    {data.balanceMethodLabel ? (
                      <Text style={styles.paymentMeta}>{data.balanceMethodLabel}</Text>
                    ) : (
                      <Text style={styles.paymentMeta}>{v('Salvo diverse indicazioni di IschiaStars.','Unless otherwise advised by IschiaStars.')}</Text>
                    )}
                  </View>
                )
              ) : null}
            </View>
          </View>

          {voucherNotes ? (
            <View style={[styles.card, styles.cardAccentGold, { marginBottom: 8 }]} wrap={false}>
              <Text style={styles.sectionTitle}>{v('Note della prenotazione','Booking notes')}</Text>
              <Text style={styles.notesText}>{voucherNotes}</Text>
            </View>
          ) : null}

          {cancellationPolicy ? (
            <View style={[styles.card, styles.cardAccentNavy, { marginBottom: 8 }]}>
              <Text style={styles.sectionTitle}>{v('Policy di cancellazione','Cancellation policy')}</Text>
              <Text style={styles.notesText}>{cancellationPolicy}</Text>
            </View>
          ) : null}

          <View style={styles.notes} wrap={false}>
            <Text style={styles.notesTitle}>{v('Note importanti','Important information')}</Text>
            <Text style={styles.notesText}>
              {data.isBalancePaid
                ? v("Soggiorno interamente saldato. Extra, tasse di soggiorno e servizi non indicati nel voucher sono esclusi. Presentare il voucher al check-in con documento valido.", "Your stay is fully paid. Extras, tourist taxes and services not listed in this voucher are excluded. Present this voucher and valid identification at check-in.")
                : v("Il saldo sarà versato direttamente in struttura, salvo diverse indicazioni. Extra, tasse di soggiorno e servizi non indicati nel voucher sono esclusi. Presentare il voucher al check-in con documento valido.", "The balance is payable as specified in your booking payment conditions. Extras, tourist taxes and services not listed in this voucher are excluded. Present this voucher and valid identification at check-in.")}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View>
            <Text style={styles.footerBrand}>IschiaStars</Text>
            <Text style={styles.footerContact}>{v("Assistenza WhatsApp", "WhatsApp support")} +{data.whatsappNumber}</Text>
          </View>
          <Text style={styles.footerCode}>VOUCHER {data.quoteCode}-V</Text>
        </View>
      </Page>
    </Document>
  );
}
