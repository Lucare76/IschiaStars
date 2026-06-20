import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { IschiaStarsLogo } from "@/components/IschiaStarsLogo";
import { PublicQuotePage } from "@/components/PublicQuotePage";
import { getQuoteByCodeAndToken } from "@/lib/repositories/quotes";
import { getConfirmedHotelCounts } from "@/lib/repositories/quoteConfirmations";
import { getQuoteEventStats, trackQuoteEvent } from "@/lib/repositories/quoteEvents";
import { getFeatureFlags } from "@/lib/repositories/settings";
import { listExtraServiceEmailItems } from "@/lib/repositories/extraServiceEmailItems";
import { getAdminSession } from "@/lib/server/auth-guard";
import { getRequestIp, isTrackingExcludedIp } from "@/lib/server/trackingFilters";
import { ischiastarsWhatsappNumber, siteBaseUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

const defaultMetadata: Metadata = {
  title: "Preventivo IschiaStars",
  description: "La tua proposta personalizzata per una vacanza a Ischia.",
  robots: {
    index: false,
    follow: false
  },
  openGraph: {
    title: "Preventivo IschiaStars",
    description: "La tua proposta personalizzata per una vacanza a Ischia.",
    siteName: "IschiaStars",
    type: "website",
    images: [{ url: absoluteUrl("/ischiastars-logo.png") }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Preventivo IschiaStars",
    description: "La tua proposta personalizzata per una vacanza a Ischia.",
    images: [absoluteUrl("/ischiastars-logo.png")]
  }
};

export async function generateMetadata({ params, searchParams }: { params: { code: string }; searchParams?: { token?: string } }): Promise<Metadata> {
  return generateQuoteMetadata(params.code, searchParams?.token);
}

export async function generateQuoteMetadata(code: string, token?: string): Promise<Metadata> {
  const result = await getQuoteByCodeAndToken(code, token);
  const quote = result.data;
  if (!quote || quote.deletedAt) return defaultMetadata;

  const hotelOptions = quote.hotelOptions.length ? quote.hotelOptions : [];
  const hotelGroups = new Map<number, typeof hotelOptions>();
  for (const option of hotelOptions) {
    const group = option.hotelGroup ?? 1;
    hotelGroups.set(group, [...(hotelGroups.get(group) ?? []), option]);
  }

  const isSingleHotel = hotelGroups.size <= 1;
  const singleHotel = hotelOptions[0];
  const hotelName = isSingleHotel ? singleHotel?.hotelName || quote.proposedHotel.name : undefined;
  const hotelImage = isSingleHotel
    ? singleHotel?.hotelImageUrl || quote.proposedHotel.imageUrl || quote.proposedHotel.externalImageUrl
    : undefined;

  const title = hotelName ? `${hotelName} - Preventivo IschiaStars` : "Preventivo IschiaStars";
  const description = hotelName
    ? `La proposta IschiaStars per ${hotelName}, pronta da consultare e confermare online.`
    : "La tua proposta personalizzata per una vacanza a Ischia.";
  const imageUrl = hotelImage ? absoluteUrl(hotelImage) : absoluteUrl("/ischiastars-logo.png");

  return {
    ...defaultMetadata,
    title,
    description,
    openGraph: {
      ...defaultMetadata.openGraph,
      title,
      description,
      url: absoluteUrl(`/preventivi/${quote.code}?token=${quote.token}`),
      images: [{ url: imageUrl, alt: hotelName ?? "IschiaStars" }]
    },
    twitter: {
      ...defaultMetadata.twitter,
      title,
      description,
      images: [imageUrl]
    }
  };
}

export default async function QuotePublicRoute({ params, searchParams }: { params: { code: string }; searchParams: { token?: string; source?: string } }) {
  const result = await getQuoteByCodeAndToken(params.code, searchParams.token);
  const quote = result.data;
  if (!quote || quote.deletedAt) return <InvalidQuotePage />;

  const [hotelPopularity, eventStats, featureFlagsResult, adminSession] = await Promise.all([
    getConfirmedHotelCounts(),
    getQuoteEventStats(quote.id),
    getFeatureFlags(),
    getAdminSession(),
  ]);

  const travelServices = featureFlagsResult.data.emailTravelServicesBox
    ? (await listExtraServiceEmailItems(true)).data
    : [];

  const openingsCount = eventStats.data?.openings ?? 0;
  const showHesitantBanner = openingsCount >= 3 && quote.status !== "confermato";
  const trackOpening = !adminSession;

  if (trackOpening && searchParams.source === "whatsapp") {
    await trackWhatsAppQuoteOpening(quote.id);
  }

  return (
    <PublicQuotePage
      quote={quote}
      hotelPopularity={hotelPopularity}
      showHesitantBanner={showHesitantBanner}
      featureFlags={featureFlagsResult.data}
      travelServices={travelServices}
      trackOpening={trackOpening && searchParams.source !== "whatsapp"}
      openingSource={searchParams.source}
    />
  );
}

async function trackWhatsAppQuoteOpening(quoteId: string) {
  const requestHeaders = headers();
  const userAgent = requestHeaders.get("user-agent") ?? undefined;
  const ip = getRequestIp(requestHeaders);
  if (!userAgent || !ip || isTrackingExcludedIp(ip)) return;

  await trackQuoteEvent(quoteId, "quote_opened", {
    source: "whatsapp_quote_link",
    ip,
    user_agent: userAgent,
    excluded_from_tracking: false
  }, userAgent);
}

function absoluteUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return `${siteBaseUrl()}${value.startsWith("/") ? value : `/${value}`}`;
}

function InvalidQuotePage() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <section className="max-w-xl rounded-[28px] bg-white p-8 text-center shadow-soft">
        <div className="flex justify-center">
          <IschiaStarsLogo />
        </div>
        <h1 className="mt-8 text-3xl font-black text-ischia-navy">Preventivo non disponibile o link non valido</h1>
        <p className="mt-3 text-ischia-ink/70">Controlla il link ricevuto oppure scrivi a IschiaStars su WhatsApp per ricevere di nuovo la tua proposta.</p>
        <Link className="mt-6 inline-flex rounded-full bg-ischia-leaf px-5 py-3 font-black text-white" href={`https://wa.me/${ischiastarsWhatsappNumber()}`}>
          Scrivi su WhatsApp
        </Link>
      </section>
    </main>
  );
}
