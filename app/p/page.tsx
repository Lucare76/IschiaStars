import { headers } from "next/headers";
import { PublicQuoteLinkError } from "@/components/PublicQuoteLinkError";

export const dynamic = "force-dynamic";

export default function MissingShortQuoteLinkPage() {
  const requestHeaders = headers();
  console.info("[short-quote-link]", JSON.stringify({
    shortCode: "",
    quoteId: null,
    userAgent: requestHeaders.get("user-agent"),
    openedAt: new Date().toISOString(),
    outcome: "missing",
    referrer: requestHeaders.get("referer")
  }));
  return <PublicQuoteLinkError />;
}
