"use client";

import type { ReactNode } from "react";
import { WelcomeOverlay } from "@/components/public/WelcomeOverlay";

type Props = {
  children: ReactNode;
  customerFirstName: string;
  quoteCode: string;
};

export function QuotePageWrapper({ children, customerFirstName, quoteCode }: Props) {
  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <WelcomeOverlay customerFirstName={customerFirstName} quoteCode={quoteCode} />
      {children}
    </div>
  );
}
