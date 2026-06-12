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
    fontSize: 9,
    fontFamily: "Helvetica",
    color: DARK,
    backgroundColor: SOFT_BG,
  },

  // ─── HEADER ───
  topAccent: { height: 4, backgroundColor: GOLD },
  headerBand: {
    backgroundColor: NAVY,
    paddingHorizontal: 28,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: { width: 98, height: 38, objectFit: "contain" },
  brandText: { fontSize: 17, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  headerSub: {
    fontSize: 7,
    color: GOLD,
    marginTop: 3,
    letterSpacing: 1.0,
    textAlign: "center",
  },
  confirmedBadge: {
    borderWidth: 1.5,
    borderColor: GOLD,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  confirmedBadgeText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
    letterSpacing: 1.2,
  },
  headerGoldLine: { height: 2, backgroundColor: GOLD },

  // ─── BODY ───
  // paddingBottom = footer height (~44pt) + safe margin (14pt)
  body: {
    paddingHorizontal: 28,
    paddingTop: 13,
    paddingBottom: 58,
  },

  // ─── BOOKING HERO CARD ───
  bookingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 7,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  bookingCardAccent: {
    height: 3,
    width: 32,
    backgroundColor: GOLD,
    borderRadius: 2,
    marginBottom: 7,
  },
  bookingCardHotel: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 6,
  },
  bookingCardSubtitleRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  bookingCardChipNavy: {
    backgroundColor: "#EDF1F5",
    borderRadius: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#C8D5E0",
  },
  bookingCardChipNavyText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
  bookingCardChipGold: {
    backgroundColor: LIGHT_GOLD_BG,
    borderRadius: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
  },
  bookingCardChipGoldText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#7A5C10",
  },
  bookingCardBoxRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  bookingCardBox: {
    flex: 1,
    backgroundColor: NAVY,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  bookingCardBoxCompact: { flex: 0.6 },
  bookingCardBoxLabel: {
    fontSize: 6,
    color: GOLD,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 3,
  },
  bookingCardBoxValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
  },
  bookingCardDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 8,
  },
  bookingCardRefRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bookingCardRefLabel: { fontSize: 7, color: GRAY },
  bookingCardRefValue: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },

  // ─── SECTION SHARED ───
  sectionTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textTransform: "uppercase",
    letterSpacing: 0.9,
    marginBottom: 7,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  sectionTitleGold: {
    borderBottomColor: GOLD_BORDER,
    color: "#7A5C10",
  },

  // ─── TWO COLUMNS ───
  columnsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  columnLeft: { flex: 1 },
  columnRight: { flex: 1 },
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 7,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  row: { flexDirection: "row", marginBottom: 3 },
  rowLabel: { width: 84, fontSize: 7, color: GRAY },
  rowValue: { flex: 1, fontSize: 8, fontFamily: "Helvetica-Bold", color: DARK },

  // ─── SERVICE PILLS ───
  servicesSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 7,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 10,
  },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pill: {
    backgroundColor: "#EEF2F7",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#C5D2DF",
  },
  pillText: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },

  // ─── PAYMENT ───
  paymentSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 7,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 10,
  },
  paymentInner: {
    backgroundColor: SOFT_BG,
    borderRadius: 5,
    padding: 10,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  paymentLabel: { fontSize: 7.5, color: GRAY },
  paidChip: {
    backgroundColor: "#DCFCE7",
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  paidChipText: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#15803D",
  },
  paymentDateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  paymentDateLabel: { fontSize: 7.5, color: GRAY },
  paymentDateValue: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: DARK },
  paymentDivider: { height: 1, backgroundColor: BORDER, marginVertical: 6 },
  balanceDue: {
    marginTop: 8,
    backgroundColor: "#FFF7ED",
    borderRadius: 5,
    padding: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  balanceDueLabel: { fontSize: 8, color: "#92400E" },
  balanceDueValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#B45309",
  },

  // ─── NOTES ───
  notesSection: {
    backgroundColor: LIGHT_GOLD_BG,
    borderRadius: 7,
    padding: 10,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    marginBottom: 10,
  },
  notesText: {
    fontSize: 7.5,
    color: "#6B4E00",
    lineHeight: 1.55,
  },

  // ─── FOOTER (absolute, non-fixed: appare solo su pagina 1) ───
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: NAVY,
    paddingVertical: 11,
    paddingHorizontal: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerLeft: { flex: 1 },
  footerThanks: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  footerContact: { fontSize: 7, color: "#94A3B8" },
  footerCode: { fontSize: 7, color: GOLD, textAlign: "right" },
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

function DataRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function VoucherDocument({ data }: { data: VoucherDocumentData }) {
  const services = (data.includedServices ?? []).filter(Boolean);
  const hasSubtitle = data.roomTypeLabel || data.treatmentLabel;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Top gold accent ── */}
        <View style={styles.topAccent} />

        {/* ── Header navy ── */}
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

        {/* ── Body ── */}
        <View style={styles.body}>

          {/* === BOOKING HERO CARD === */}
          <View style={styles.bookingCard}>
            <View style={styles.bookingCardAccent} />

            {data.hotelName ? (
              <Text style={styles.bookingCardHotel}>{data.hotelName}</Text>
            ) : null}

            {/* Camera + Trattamento chips */}
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

            {/* Arrivo / Partenza / Notti / Ospiti */}
            <View style={styles.bookingCardBoxRow}>
              {data.arrivalDate ? (
                <View style={styles.bookingCardBox}>
                  <Text style={styles.bookingCardBoxLabel}>Arrivo</Text>
                  <Text style={styles.bookingCardBoxValue}>{data.arrivalDate}</Text>
                </View>
              ) : null}
              {data.departureDate ? (
                <View style={styles.bookingCardBox}>
                  <Text style={styles.bookingCardBoxLabel}>Partenza</Text>
                  <Text style={styles.bookingCardBoxValue}>{data.departureDate}</Text>
                </View>
              ) : null}
              {data.nightsCount ? (
                <View style={[styles.bookingCardBox, styles.bookingCardBoxCompact]}>
                  <Text style={styles.bookingCardBoxLabel}>Notti</Text>
                  <Text style={styles.bookingCardBoxValue}>{data.nightsCount}</Text>
                </View>
              ) : null}
              {data.guestsLabel ? (
                <View style={styles.bookingCardBox}>
                  <Text style={styles.bookingCardBoxLabel}>Ospiti</Text>
                  <Text style={styles.bookingCardBoxValue}>{data.guestsLabel}</Text>
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
                <Text style={styles.sectionTitle}>Dati cliente</Text>
                <DataRow label="Nome" value={data.clientFullName} />
                <DataRow label="Email" value={data.clientEmail} />
                <DataRow label="Telefono" value={data.clientPhone} />
              </View>
            </View>
            <View style={styles.columnRight}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Dettagli soggiorno</Text>
                <DataRow label="Struttura" value={data.hotelName} />
                <DataRow label="Camera" value={data.roomTypeLabel} />
                <DataRow label="Trattamento" value={data.treatmentLabel} />
                <DataRow label="Arrivo" value={data.arrivalDate} />
                <DataRow label="Partenza" value={data.departureDate} />
                {data.nightsCount ? (
                  <DataRow
                    label="Durata"
                    value={`${data.nightsCount} ${data.nightsCount === 1 ? "notte" : "notti"}`}
                  />
                ) : null}
                <DataRow label="Ospiti" value={data.guestsLabel} />
              </View>
            </View>
          </View>

          {/* === SERVIZI INCLUSI — pill badges === */}
          {services.length > 0 ? (
            <View style={styles.servicesSection}>
              <Text style={styles.sectionTitle}>Servizi inclusi</Text>
              <View style={styles.pillsRow}>
                {services.map((service, index) => (
                  <View key={index} style={styles.pill}>
                    <Text style={styles.pillText}>{service}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* === PAGAMENTO === */}
          <View style={styles.paymentSection}>
            <Text style={styles.sectionTitle}>Pagamento</Text>
            <View style={styles.paymentInner}>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Caparra versata</Text>
                <View style={styles.paidChip}>
                  <Text style={styles.paidChipText}>{data.depositAmountLabel} ✓</Text>
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

          {/* === NOTE IMPORTANTI (compatte, una sola sezione) === */}
          <View style={styles.notesSection}>
            <Text style={[styles.sectionTitle, styles.sectionTitleGold]}>Note importanti</Text>
            <Text style={styles.notesText}>
              {"• Il saldo sarà versato direttamente in struttura al check-in, salvo diverse indicazioni di IschiaStars.\n• Extra, tasse di soggiorno e servizi non indicati nel voucher sono esclusi dal prezzo confermato.\n• Presentare il voucher al check-in con documento d’identità valido."}
            </Text>
          </View>

        </View>

        {/* ── Footer: position absolute, non fixed → solo pagina 1 ── */}
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <Text style={styles.footerThanks}>Grazie per aver scelto IschiaStars</Text>
            <Text style={styles.footerContact}>Per informazioni: WhatsApp +{data.whatsappNumber}</Text>
          </View>
          <Text style={styles.footerCode}>N. {data.quoteCode}-V</Text>
        </View>
      </Page>
    </Document>
  );
}
