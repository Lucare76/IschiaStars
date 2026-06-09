import path from "path";
import fs from "fs";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const NAVY = "#1B3A5C";
const GOLD = "#C9A84C";
const GRAY = "#6B7280";
const DARK = "#111827";
const BORDER = "#D9E2EC";
const SOFT_BG = "#F6F8FB";

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
    backgroundColor: SOFT_BG
  },
  topAccent: {
    height: 5,
    backgroundColor: GOLD
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
    objectFit: "contain"
  },
  brandText: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF"
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
    paddingTop: 22,
    paddingBottom: 90
  },
  bookingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: BORDER,
  },
  bookingCardAccent: {
    height: 3,
    width: 36,
    backgroundColor: GOLD,
    borderRadius: 2,
    marginBottom: 14,
  },
  bookingCardHotel: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 4
  },
  bookingCardTreatment: {
    fontSize: 10,
    color: GRAY,
    marginBottom: 16
  },
  bookingCardRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 4
  },
  bookingCardItem: {
    flexDirection: "column",
    flex: 1,
    backgroundColor: NAVY,
    borderRadius: 8,
    padding: 12
  },
  bookingCardItemLabel: {
    fontSize: 7,
    color: GOLD,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4
  },
  bookingCardItemValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF"
  },
  bookingCardDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 14
  },
  bookingCardRefRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  bookingCardRefLabel: {
    fontSize: 8,
    color: GRAY
  },
  bookingCardRefValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: NAVY
  },
  columnsRow: {
    flexDirection: "row",
    gap: 18,
    marginBottom: 18
  },
  columnLeft: { flex: 1 },
  columnRight: { flex: 1 },
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB"
  },
  sectionTitleBar: {
    width: 3,
    height: 10,
    backgroundColor: GOLD,
    borderRadius: 2,
    marginRight: 7
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
    marginBottom: 5
  },
  label: {
    width: 110,
    fontSize: 9,
    color: GRAY
  },
  value: {
    flex: 1,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: DARK
  },
  serviceItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6
  },
  serviceCheck: {
    fontSize: 10,
    color: GOLD,
    fontFamily: "Helvetica-Bold",
    marginRight: 7,
  },
  serviceText: {
    fontSize: 10,
    color: DARK,
    flex: 1
  },
  paymentSection: {
    marginBottom: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER
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
    marginBottom: 8
  },
  paymentLabel: {
    fontSize: 9,
    color: GRAY
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
    marginVertical: 8
  },
  paymentDateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  paymentDateLabel: {
    fontSize: 9,
    color: GRAY
  },
  paymentDateValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: DARK
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
    borderColor: "#FED7AA"
  },
  balanceDueLabel: {
    fontSize: 9,
    color: "#92400E"
  },
  balanceDueValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#B45309"
  },
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
    marginBottom: 3
  },
  footerContact: {
    fontSize: 8,
    color: "#94A3B8"
  },
  footerDocNumber: {
    fontSize: 8,
    color: GOLD,
    textAlign: "right"
  }
});

export type VoucherDocumentData = {
  quoteCode: string;
  clientFullName: string;
  clientEmail?: string;
  clientPhone?: string;
  hotelName?: string;
  treatmentLabel?: string;
  arrivalDate?: string;
  departureDate?: string;
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

export function VoucherDocument({ data }: { data: VoucherDocumentData }) {
  const services = (data.includedServices ?? []).filter(Boolean);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topAccent} />

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
          <View style={styles.bookingCard}>
            <View style={styles.bookingCardAccent} />
            {data.hotelName ? <Text style={styles.bookingCardHotel}>{data.hotelName}</Text> : null}
            {data.treatmentLabel ? <Text style={styles.bookingCardTreatment}>{data.treatmentLabel}</Text> : null}
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

          <View style={styles.columnsRow}>
            <View style={styles.columnLeft}>
              <View style={styles.section}>
                <SectionTitle>Dati cliente</SectionTitle>
                <Row label="Nome" value={data.clientFullName} />
                <Row label="Email" value={data.clientEmail} />
                <Row label="Telefono" value={data.clientPhone} />
              </View>
            </View>

            {services.length > 0 ? (
              <View style={styles.columnRight}>
                <View style={styles.section}>
                  <SectionTitle>Cosa include</SectionTitle>
                  {services.map((service, index) => (
                    <View key={index} style={styles.serviceItem}>
                      <Text style={styles.serviceCheck}>✓</Text>
                      <Text style={styles.serviceText}>{service}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>

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
        </View>

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
