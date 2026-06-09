import path from "path";
import fs from "fs";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const NAVY = "#1B3A5C";
const GOLD = "#C9A84C";
const LIGHT_BLUE = "#EEF3F8";
const GRAY = "#6B7280";
const DARK = "#111827";

const logoPath = path.join(process.cwd(), "public", "ischiastars-logo.png");
const logoExists = fs.existsSync(logoPath);

const styles = StyleSheet.create({
  page: {
    padding: 0,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: DARK,
    backgroundColor: "#FFFFFF"
  },
  headerBar: {
    backgroundColor: NAVY,
    paddingHorizontal: 36,
    paddingVertical: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  logo: {
    width: 110,
    height: 44,
    objectFit: "contain"
  },
  brandText: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF"
  },
  headerRight: {
    textAlign: "right"
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: 0.5
  },
  headerSub: {
    fontSize: 9,
    color: GOLD,
    marginTop: 3,
    letterSpacing: 0.3
  },
  goldBar: {
    height: 3,
    backgroundColor: GOLD
  },
  body: {
    paddingHorizontal: 36,
    paddingTop: 24,
    paddingBottom: 90
  },
  bookingCard: {
    backgroundColor: LIGHT_BLUE,
    borderRadius: 6,
    padding: 18,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: GOLD
  },
  bookingCardHotel: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginBottom: 4
  },
  bookingCardTreatment: {
    fontSize: 10,
    color: GRAY,
    marginBottom: 12
  },
  bookingCardRow: {
    flexDirection: "row",
    gap: 32,
    marginBottom: 4
  },
  bookingCardItem: {
    flexDirection: "column"
  },
  bookingCardItemLabel: {
    fontSize: 8,
    color: GRAY,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2
  },
  bookingCardItemValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: NAVY
  },
  bookingCardDivider: {
    height: 1,
    backgroundColor: "#D1D9E3",
    marginVertical: 12
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
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: NAVY
  },
  columnsRow: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 20
  },
  columnLeft: {
    flex: 1
  },
  columnRight: {
    flex: 1
  },
  section: {
    marginBottom: 20
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB"
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
    marginBottom: 5
  },
  serviceCheck: {
    fontSize: 10,
    color: GOLD,
    fontFamily: "Helvetica-Bold",
    marginRight: 6,
    marginTop: 0
  },
  serviceText: {
    fontSize: 10,
    color: DARK,
    flex: 1
  },
  paymentHighlight: {
    backgroundColor: "#F0FDF4",
    borderRadius: 6,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: "#22C55E"
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6
  },
  paymentLabel: {
    fontSize: 9,
    color: GRAY
  },
  paymentValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: DARK
  },
  paymentValueGreen: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#15803D"
  },
  paymentDivider: {
    height: 1,
    backgroundColor: "#D1FAE5",
    marginVertical: 8
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2
  },
  balanceLabel: {
    fontSize: 9,
    color: GRAY
  },
  balanceValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: NAVY
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: NAVY,
    paddingVertical: 14,
    paddingHorizontal: 36,
    textAlign: "center"
  },
  footerThanks: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    marginBottom: 4
  },
  footerContact: {
    fontSize: 9,
    color: "#94A3B8"
  },
  footerDocNumber: {
    fontSize: 8,
    color: GOLD,
    marginTop: 6
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

export function VoucherDocument({ data }: { data: VoucherDocumentData }) {
  const services = (data.includedServices ?? []).filter(Boolean);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerBar}>
          {logoExists ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={logoPath} style={styles.logo} />
          ) : (
            <Text style={styles.brandText}>IschiaStars</Text>
          )}
          <View style={styles.headerRight}>
            <Text style={styles.headerTitle}>VOUCHER DI PRENOTAZIONE</Text>
            <Text style={styles.headerSub}>DOCUMENTO UFFICIALE · ISCHIA STARS</Text>
          </View>
        </View>
        <View style={styles.goldBar} />

        <View style={styles.body}>
          {/* Booking card */}
          <View style={styles.bookingCard}>
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
              <Text style={styles.bookingCardRefValue}>{data.quoteCode}</Text>
            </View>
          </View>

          {/* Two columns: client + included services */}
          <View style={styles.columnsRow}>
            {/* Dati cliente */}
            <View style={styles.columnLeft}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Dati cliente</Text>
                <Row label="Nome" value={data.clientFullName} />
                <Row label="Email" value={data.clientEmail} />
                <Row label="Telefono" value={data.clientPhone} />
              </View>
            </View>

            {/* Cosa include */}
            {services.length > 0 ? (
              <View style={styles.columnRight}>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Cosa include</Text>
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

          {/* Payment */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pagamento</Text>
            <View style={styles.paymentHighlight}>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Caparra versata</Text>
                <Text style={styles.paymentValueGreen}>{data.depositAmountLabel}</Text>
              </View>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Data pagamento</Text>
                <Text style={styles.paymentValue}>{data.depositPaidAtLabel}</Text>
              </View>
              {data.balanceAmountLabel ? (
                <>
                  <View style={styles.paymentDivider} />
                  <View style={styles.balanceRow}>
                    <Text style={styles.balanceLabel}>Saldo residuo da versare in struttura</Text>
                    <Text style={styles.balanceValue}>{data.balanceAmountLabel}</Text>
                  </View>
                </>
              ) : null}
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerThanks}>Grazie per aver scelto IschiaStars</Text>
          <Text style={styles.footerContact}>Per qualsiasi informazione scrivici su WhatsApp al +{data.whatsappNumber}</Text>
          <Text style={styles.footerDocNumber}>Documento n. {data.quoteCode}-V</Text>
        </View>
      </Page>
    </Document>
  );
}
