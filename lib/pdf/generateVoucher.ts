import { renderToBuffer } from "@react-pdf/renderer";
import { VoucherDocument, VoucherDocumentData } from "@/lib/pdf/VoucherDocument";

export async function generateVoucherPdf(data: VoucherDocumentData): Promise<Buffer> {
  return renderToBuffer(VoucherDocument({ data }));
}
