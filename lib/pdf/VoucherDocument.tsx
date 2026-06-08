import path from "path";
import fs from "fs";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const NAVY = "#1B3A5C";
const GOLD = "#C9A84C";

const logoPath = path.join(process.cwd(), "public", "ischiastars-logo.png");
const logoExists = fs.existsSync(logoPath);

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#1F2937"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: GOLD,
    paddingBottom: 16,
    marginBottom: 24
  },
  logo: {
    width: 120,
    height: 48,
    objectFit: "contain"
  },
  brandText: {
    fontSize: 22,
    fontWeight: 700,
    color: NAVY
  },
  headerTitles: {
    textAlign: "right"
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: NAVY
  },
  subtitle: {
    fontSize: 11,
    color: GOLD,
    marginTop: 2
  },
  section: {
    marginBottom: 18
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: NAVY,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB"
  },
  row: {
    flexDirection: "row",
    marginBottom: 4
  },
  label: {
    width: 140,
    color: "#6B7280"
  },
  value: {
    flex: 1,
    fontWeight: 700,
    color: "#1F2937"
  },
  footer: {
    position: "absolute",
    bottom: 36,
    left: 36,
    right: 36,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    textAlign: "center"
  },
  footerThanks: {
    fontSize: 12,
    fontWeight: 700,
    color: NAVY,
    marginBottom: 4
  },
  footerContact: {
    fontSize: 9,
    color: "#6B7280"
  },
  footerDocNumber: {
    fontSize: 8,
    color: "#9CA3AF",
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
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {logoExists ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={logoPath} style={styles.logo} />
          ) : (
            <Text style={styles.brandText}>IschiaStars</Text>
          )}
          <View style={styles.headerTitles}>
            <Text style={styles.title}>VOUCHER DI PRENOTAZIONE</Text>
            <Text style={styles.subtitle}>Ricevuta pagamento caparra</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dati cliente</Text>
          <Row label="Nome completo" value={data.clientFullName} />
          <Row label="Email" value={data.clientEmail} />
          <Row label="Telefono" value={data.clientPhone} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prenotazione</Text>
          <Row label="Codice preventivo" value={data.quoteCode} />
          <Row label="Hotel" value={data.hotelName} />
          <Row label="Trattamento" value={data.treatmentLabel} />
          <Row label="Arrivo" value={data.arrivalDate} />
          <Row label="Partenza" value={data.departureDate} />
          <Row label="Ospiti" value={data.guestsLabel} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pagamento</Text>
          <Row label="Caparra versata" value={data.depositAmountLabel} />
          <Row label="Data pagamento" value={data.depositPaidAtLabel} />
          <Row label="Saldo residuo" value={data.balanceAmountLabel} />
          <Row label="Modalità saldo" value={data.balanceMethodLabel} />
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerThanks}>Grazie per aver scelto IschiaStars</Text>
          <Text style={styles.footerContact}>Per qualsiasi informazione scrivici su WhatsApp al +{data.whatsappNumber}</Text>
          <Text style={styles.footerDocNumber}>Documento n. {data.quoteCode}-V</Text>
        </View>
      </Page>
    </Document>
  );
}
