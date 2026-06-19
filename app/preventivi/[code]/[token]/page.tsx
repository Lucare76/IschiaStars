import type { Metadata } from "next";
import QuotePublicRoute, { generateQuoteMetadata } from "../page";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { code: string; token: string } }): Promise<Metadata> {
  return generateQuoteMetadata(params.code, params.token);
}

export default async function QuotePublicRouteWithToken({ params, searchParams }: { params: { code: string; token: string }; searchParams?: { source?: string } }) {
  return QuotePublicRoute({ params: { code: params.code }, searchParams: { token: params.token, source: searchParams?.source } });
}
