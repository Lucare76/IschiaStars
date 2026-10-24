import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { getQuoteByShortCode } from "@/lib/repositories/quotes";
import { siteBaseUrl } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { shortCode: string } }) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  // Non registrare codici pubblici, URL delle foto o dati del cliente.
  const report = (outcome: string, details: Record<string, string | number> = {}) => {
    console.info("[quote-preview]", JSON.stringify({
      requestId, outcome, durationMs: Date.now() - startedAt, ...details
    }));
  };
  const fallback = (reason: string, details: Record<string, string | number> = {}) => {
    report(reason, details);
    const response = fallbackLogo(request);
    response.headers.set("cache-control", "no-store");
    response.headers.set("x-preview-request-id", requestId);
    return response;
  };
  const shortCode = safeDecode(params.shortCode);
  if (!shortCode || !/^[0-9a-f]{16}$/.test(shortCode)) {
    return fallback("invalid_code");
  }

  const lookupStartedAt = Date.now();
  let quoteResult;
  try {
    quoteResult = await getQuoteByShortCode(shortCode);
  } catch (error) {
    return fallback("quote_lookup_error", {
      lookupMs: Date.now() - lookupStartedAt,
      errorType: error instanceof Error ? error.name : "unknown"
    });
  }
  const lookupMs = Date.now() - lookupStartedAt;
  const quote = quoteResult.data;
  if (!quote || quote.deletedAt) return fallback("quote_unavailable", { lookupMs });

  const hotelOptions = quote.hotelOptions.length ? quote.hotelOptions : [];
  const hotelGroups = new Set(hotelOptions.map((option) => option.hotelGroup ?? 1));
  const singleHotel = hotelOptions[0];
  const hotelImage = hotelGroups.size <= 1
    ? singleHotel?.hotelImageUrl || quote.proposedHotel.imageUrl || quote.proposedHotel.externalImageUrl
    : undefined;

  if (!hotelImage) return fallback("no_hotel_image", { lookupMs });

  const imageStartedAt = Date.now();
  try {
    const imageUrl = absoluteImageUrl(hotelImage);
    let response = await fetch(imageUrl, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; IschiaStarsOpenGraph/1.0)",
        accept: "*/*"
      }
    });

    // Alcuni CDN negoziano male il formato o conservano una risposta 415.
    // Un solo nuovo tentativo, senza cache, prima del ripiego sul logo.
    if (response.status === 415) {
      report("image_retry", { lookupMs, status: response.status });
      response = await fetch(imageUrl, {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
        headers: { accept: "*/*" }
      });
    }
    if (!response.ok) return fallback("image_http_error", { lookupMs, status: response.status });

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/")) return fallback("invalid_image_type", { lookupMs });

    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength) return fallback("empty_image", { lookupMs });

    const jpeg = await sharp(Buffer.from(bytes), { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 82, progressive: false })
      .toBuffer({ resolveWithObject: true });

    report("success", {
      lookupMs, imageMs: Date.now() - imageStartedAt,
      bytes: jpeg.data.byteLength, contentType: "image/jpeg", sourceContentType: contentType,
      width: jpeg.info.width, height: jpeg.info.height
    });

    return new NextResponse(new Uint8Array(jpeg.data), {
      status: 200,
      headers: {
        "content-type": "image/jpeg",
        "content-length": String(jpeg.data.byteLength),
        "x-preview-request-id": requestId,
        "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
      }
    });
  } catch (error) {
    return fallback("image_fetch_error", { lookupMs, errorType: error instanceof Error ? error.name : "unknown" });
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
