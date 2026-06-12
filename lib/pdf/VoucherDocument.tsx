import path from "path";
import fs from "fs";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const NAVY = "#1B3A5C";
const GOLD = "#C9A84C";
const GRAY = "#6B7280";
const DARK = "#111827";
const BORDER = "#D9E2EC";
const SOFT_BG = "#F6F8FB";
const LIGHT_GOLD_BG = "#FFFBF0";
const GOLD_BORDER = "#E8D5A0";

const logoPath = path.join(process.cwd(), "public", "ischiastars-logo.png");
const logoSrc = fs.existsSync(logoPath)
  ? `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`
  : null;

const styles = StyleSheet.create({
  page: {
    padding: 0,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: DARK,
    backgroundColor: SOFT_BG,
  },
  topAccent: {
    height: 5,
    backgroundColor: GOLD,
  },
  headerBand: {
    backgroundColor: NAVY,
    paddingHorizontal: 32,
    paddingTop: 20,
    paddingBottom: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    width: 118,
    height: 46,
    objectFit: "contain",
  },
  brandText: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  headerSub: {
    fontSize: 8,
    color: GOLD,
    marginTop: 4,
    letterSpacing: 1.2,
    textAlign: "center",
  },
  confirmedBadge: {
    borderWidth: 1.5,
    borderColor: GOLD,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  confirmedBadgeText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
    letterSpacing: 1.5,
  },
  headerGoldLine: {
    height: 2,
    backgroundColor: GOLD,
  },
  body: {
    paddingHorizontal: 32,
    paddingTop: 20,
    paddingBottom: 90,
  },

  // ─── BOOKING HERO CARD ───
  bookingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  bookingCardAccent: {
    height: 3,
    width: 40,
    backgroundColor: GOLD,
    borderRadius: 2,
    marginBottom: 12,
  },
  bookingCardHotel: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 8,
  },
  bookingCardSubtitleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  bookingCardChipNavy: {
    backgroundColor: "#EDF1F5",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#C8D5E0",
  },
  bookingCardChipNavyText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
  bookingCardChipGold: {
    backgroundColor: LIGHT_GOLD_BG,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
  },
  bookingCardChipGoldText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#7A5C10",
  },
  bookingCardRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 4,
  },
  bookingCardItem: {
    flex: 1,
    backgroundColor: NAVY,
    borderRadius: 8,
    padding: 12,
  },
  bookingCardItemCompact: {
    flex: 0.65,
  },
  bookingCardItemLabel: {
    fontSize: 7,
    color: GOLD,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  bookingCardItemValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  bookingCardDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 12,
  },
  bookingCardRefRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bookingCardRefLabel: {
    fontSize: 8,
    color: GRAY,
  },
  bookingCardRefValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },

  // ─── TWO COLUMN LAYOUT ───
  columnsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
  },
  columnLeft: { flex: 1 },
  columnRight: { flex: 1 },
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 11,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  sectionTitleBar: {
    width: 3,
    height: 10,
    backgroundColor: GOLD,
    borderRadius: 2,
    marginRight: 7,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  row: {
    flexDirection: "row",
    marginBottom: 5,
  },
  label: {
    width: 110,
    fontSize: 8,
    color: GRAY,
  },
  value: {
    flex: 1,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: DARK,
  },

  // ─── SERVICES SECTION ───
  servicesSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  servicesGrid: {
    flexDirection: "row",
    gap: 12,
  },
  servicesCol: {
    flex: 1,
  },
  serviceItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 5,
  },
  serviceCheck: {
    fontSize: 10,
    color: GOLD,
    fontFamily: "Helvetica-Bold",
    marginRight: 7,
  },
  serviceText: {
    fontSize: 9,
    color: DARK,
    flex: 1,
  },

  // ─── PAYMENT SECTION ───
  paymentSection: {
    marginBottom: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  paymentBody: {
    backgroundColor: SOFT_BG,
    borderRadius: 8,
    padding: 14,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  paymentLabel: {
    fontSize: 9,
    color: GRAY,
  },
  paymentPaidChip: {
    backgroundColor: "#DCFCE7",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  paymentPaidText: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#15803D",
  },
  paymentDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 8,
  },
  paymentDateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  paymentDateLabel: {
    fontSize: 9,
    color: GRAY,
  },
  paymentDateValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: DARK,
  },
  balanceDue: {
    marginTop: 10,
    backgroundColor: "#FFF7ED",
    borderRadius: 6,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  balanceDueLabel: {
    fontSize: 9,
    color: "#92400E",
  },
  balanceDueValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#B45309",
  },

  // ─── NOTES SECTION ───
  notesSection: {
    backgroundColor: LIGHT_GOLD_BG,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    marginBottom: 16,
  },
  noteItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 5,
  },
  noteBullet: {
    fontSize: 10,
    color: GOLD,
    fontFamily: "Helvetica-Bold",
    marginRight: 8,
  },
  noteText: {
    fontSize: 8,
    color: "#6B4E00",
    flex: 1,
    lineHeight: 1.5,
  },

  // ─── FOOTER ───
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: NAVY,
    paddingVertical: 14,
    paddingHorizontal: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerLeft: {
    flex: 1,
  },
  footerThanks: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    marginBottom: 3,
  },
  footerContact: {
    fontSize: 8,
    color: "#94A3B8",
  },
  footerDocNumber: {
    fontSize: 8,
    color: GOLD,
    textAlign: "right",
  },
});

export type VoucherDocumentData = {
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
  balanceMethodLabel?: string;
  whatsappNumber: string;
};

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionTitleBar} />
      <Text style={styles.sectionTitle}>{children}</Text>
    </View>
  );
}

function NoteItem({ children }: { children: string }) {
  return (
    <View style={styles.noteItem}>
      <Text style={styles.noteBullet}>•</Text>
      <Text style={styles.noteText}>{children}</Text>
    </View>
  );
}

export function VoucherDocument({ data }: { data: VoucherDocumentData }) {
  const services = (data.includedServices ?? []).filter(Boolean);
  const col1Services = services.filter((_, i) => i % 2 === 0);
  const col2Services = services.filter((_, i) => i % 2 === 1);
  const hasSubtitle = data.roomTypeLabel || data.treatmentLabel;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topAccent} />

        {/* HEADER */}
        <View style={styles.headerBand}>
          {logoSrc ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={logoSrc} style={styles.logo} />
          ) : (
            <Text style={styles.brandText}>IschiaStars</Text>
          )}
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Voucher di Prenotazione</Text>
            <Text style={styles.headerSub}>ISCHIA STARS · DOCUMENTO UFFICIALE</Text>
          </View>
          <View style={styles.confirmedBadge}>
            <Text style={styles.confirmedBadgeText}>CONFERMATO</Text>
          </View>
        </View>
        <View style={styles.headerGoldLine} />

        <View style={styles.body}>
          {/* === BOOKING HERO CARD === */}
          <View style={styles.bookingCard}>
            <View style={styles.bookingCardAccent} />
            {data.hotelName ? <Text style={styles.bookingCardHotel}>{data.hotelName}</Text> : null}

            {/* Chips: tipologia camera + trattamento */}
            {hasSubtitle ? (
              <View style={styles.bookingCardSubtitleRow}>
                {data.roomTypeLabel ? (
                  <View style={styles.bookingCardChipNavy}>
                    <Text style={styles.bookingCardChipNavyText}>{data.roomTypeLabel}</Text>
                  </View>
                ) : null}
                {data.treatmentLabel ? (
                  <View style={styles.bookingCardChipGold}>
                    <Text style={styles.bookingCardChipGoldText}>{data.treatmentLabel}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Date / Notti / Ospiti boxes */}
            <View style={styles.bookingCardRow}>
              {data.arrivalDate ? (
                <View style={styles.bookingCardItem}>
                  <Text style={styles.bookingCardItemLabel}>Arrivo</Text>
                  <Text style={styles.bookingCardItemValue}>{data.arrivalDate}</Text>
                </View>
              ) : null}
              {data.departureDate ? (
                <View style={styles.bookingCardItem}>
                  <Text style={styles.bookingCardItemLabel}>Partenza</Text>
                  <Text style={styles.bookingCardItemValue}>{data.departureDate}</Text>
                </View>
              ) : null}
              {data.nightsCount ? (
                <View style={[styles.bookingCardItem, styles.bookingCardItemCompact]}>
                  <Text style={styles.bookingCardItemLabel}>Notti</Text>
                  <Text style={styles.bookingCardItemValue}>{data.nightsCount}</Text>
                </View>
              ) : null}
              {data.guestsLabel ? (
                <View style={styles.bookingCardItem}>
                  <Text style={styles.bookingCardItemLabel}>Ospiti</Text>
                  <Text style={styles.bookingCardItemValue}>{data.guestsLabel}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.bookingCardDivider} />
            <View style={styles.bookingCardRefRow}>
              <Text style={styles.bookingCardRefLabel}>Numero prenotazione</Text>
              <Text style={styles.bookingCardRefValue}>{data.quoteCode}-V</Text>
            </View>
          </View>

          {/* === DUE COLONNE: Dati Cliente + Dettagli Soggiorno === */}
          <View style={styles.columnsRow}>
            <View style={styles.columnLeft}>
              <View style={styles.section}>
                <SectionTitle>Dati cliente</SectionTitle>
                <Row label="Nome" value={data.clientFullName} />
                <Row label="Email" value={data.clientEmail} />
                <Row label="Telefono" value={data.clientPhone} />
              </View>
            </View>
            <View style={styles.columnRight}>
              <View style={styles.section}>
                <SectionTitle>Dettagli soggiorno</SectionTitle>
                {data.hotelName ? <Row label="Struttura" value={data.hotelName} /> : null}
                {data.roomTypeLabel ? <Row label="Tipologia camera" value={data.roomTypeLabel} /> : null}
                {data.treatmentLabel ? <Row label="Trattamento" value={data.treatmentLabel} /> : null}
                {data.arrivalDate ? <Row label="Arrivo" value={data.arrivalDate} /> : null}
                {data.departureDate ? <Row label="Partenza" value={data.departureDate} /> : null}
                {data.nightsCount ? (
                  <Row
                    label="Durata"
                    value={`${data.nightsCount} ${data.nightsCount === 1 ? "notte" : "notti"}`}
                  />
                ) : null}
                {data.guestsLabel ? <Row label="Ospiti" value={data.guestsLabel} /> : null}
              </View>
            </View>
          </View>

          {/* === SERVIZI INCLUSI (griglia 2 colonne) === */}
          {services.length > 0 ? (
            <View style={styles.servicesSection}>
              <SectionTitle>Servizi inclusi</SectionTitle>
              <View style={styles.servicesGrid}>
                <View style={styles.servicesCol}>
                  {col1Services.map((service, index) => (
                    <View key={index} style={styles.serviceItem}>
                      <Text style={styles.serviceCheck}>✓</Text>
                      <Text style={styles.serviceText}>{service}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.servicesCol}>
                  {col2Services.map((service, index) => (
                    <View key={index} style={styles.serviceItem}>
                      <Text style={styles.serviceCheck}>✓</Text>
                      <Text style={styles.serviceText}>{service}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ) : null}

          {/* === PAGAMENTO === */}
          <View style={styles.paymentSection}>
            <SectionTitle>Pagamento</SectionTitle>
            <View style={styles.paymentBody}>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Caparra versata</Text>
                <View style={styles.paymentPaidChip}>
                  <Text style={styles.paymentPaidText}>{data.depositAmountLabel} ✓</Text>
                </View>
              </View>
              <View style={styles.paymentDateRow}>
                <Text style={styles.paymentDateLabel}>Data pagamento</Text>
                <Text style={styles.paymentDateValue}>{data.depositPaidAtLabel}</Text>
              </View>
              {data.balanceAmountLabel ? (
                <>
                  <View style={styles.paymentDivider} />
                  <View style={styles.balanceDue}>
                    <Text style={styles.balanceDueLabel}>Saldo da versare in struttura</Text>
                    <Text style={styles.balanceDueValue}>{data.balanceAmountLabel}</Text>
                  </View>
                </>
              ) : null}
            </View>
          </View>

          {/* === NOTE IMPORTANTI === */}
          <View style={styles.notesSection}>
            <SectionTitle>Note importanti</SectionTitle>
            <NoteItem>
              Il saldo indicato sarà versato direttamente in struttura al momento del check-in, salvo diverse indicazioni ricevute da IschiaStars.
            </NoteItem>
            <NoteItem>
              Eventuali extra, tasse di soggiorno o servizi non espressamente indicati nel voucher sono esclusi dal prezzo confermato.
            </NoteItem>
            <NoteItem>
              Il presente voucher è da esibire al check-in unitamente a un documento d&apos;identità valido.
            </NoteItem>
          </View>
        </View>

        {/* FOOTER */}
        <View style={styles.footer} fixed>
          <View style={styles.footerLeft}>
            <Text style={styles.footerThanks}>Grazie per aver scelto IschiaStars</Text>
            <Text style={styles.footerContact}>Per informazioni: WhatsApp +{data.whatsappNumber}</Text>
          </View>
          <Text style={styles.footerDocNumber}>N. {data.quoteCode}-V</Text>
        </View>
      </Page>
    </Document>
  );
}
