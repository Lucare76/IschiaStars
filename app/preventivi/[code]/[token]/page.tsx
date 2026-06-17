import type { Metadata } from "next";
import QuotePublicRoute, { metadata as parentMetadata } from "../page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = parentMetadata;

export default async function QuotePublicRouteWithToken({ params }: { params: { code: string; token: string } }) {
  return QuotePublicRoute({ params: { code: params.code }, searchParams: { token: params.token } });
}
