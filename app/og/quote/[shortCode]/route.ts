import { NextRequest, NextResponse } from "next/server";
import { getQuoteByShortCode } from "@/lib/repositories/quotes";
import { siteBaseUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { shortCode: string } }) {
  const shortCode = safeDecode(params.shortCode);
  if (!shortCode || !/^[0-9a-f]{16}$/.test(shortCode)) {
    return fallbackLogo(request);
  }

  const quoteResult = await getQuoteByShortCode(shortCode);
  const quote = quoteResult.data;
  if (!quote || quote.deletedAt) return fallbackLogo(request);

  const hotelOptions = quote.hotelOptions.length ? quote.hotelOptions : [];
  const hotelGroups = new Set(hotelOptions.map((option) => option.hotelGroup ?? 1));
  const singleHotel = hotelOptions[0];
  const hotelImage = hotelGroups.size <= 1
    ? singleHotel?.hotelImageUrl || quote.proposedHotel.imageUrl || quote.proposedHotel.externalImageUrl
    : undefined;

  if (!hotelImage) return fallbackLogo(request);

  const imageUrl = absoluteImageUrl(hotelImage);
  try {
    const response = await fetch(imageUrl, {
      cache: "no-store",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; IschiaStarsOpenGraph/1.0)",
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
      }
    });

    if (!response.ok) return fallbackLogo(request);

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/")) return fallbackLogo(request);

    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength) return fallbackLogo(request);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
      }
    });
  } catch {
    return fallbackLogo(request);
  }
}

function safeDecode(value: string | undefined) {
  try {
    return decodeURIComponent(value ?? "").trim().toLowerCase();
  } catch {
    return null;
  }
}

function absoluteImageUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return `${siteBaseUrl()}${value.startsWith("/") ? value : `/${value}`}`;
}

function fallbackLogo(request: NextRequest) {
  return NextResponse.redirect(new URL("/ischiastars-logo.png", request.url), 307);
}
