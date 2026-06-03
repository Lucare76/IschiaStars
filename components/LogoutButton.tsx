"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.push("/login");
    router.refresh();
  }

  return (
    <button className="min-h-10 rounded-full bg-white px-3 py-2 font-bold text-ischia-navy transition hover:bg-ischia-sun disabled:opacity-60 sm:px-4" disabled={loading} onClick={logout} type="button">
      {loading ? "Uscita..." : "Esci"}
    </button>
  );
}
