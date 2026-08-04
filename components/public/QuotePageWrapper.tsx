"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export function QuotePageWrapper({ children }: Props) {
  return <div style={{ position: "relative", minHeight: "100vh" }}>{children}</div>;
}
