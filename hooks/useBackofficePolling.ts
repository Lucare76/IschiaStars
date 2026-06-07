"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useBackofficePolling(intervalMs = 30_000) {
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") router.refresh();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router, intervalMs]);
}
