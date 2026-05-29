import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export function SystemModeBadge() {
  const configured = isSupabaseConfigured();
  const adminConfigured = isSupabaseAdminConfigured();

  if (!configured) {
    return <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800 ring-1 ring-amber-200">Configurazione richiesta</span>;
  }

  if (!adminConfigured) {
    return <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800 ring-1 ring-amber-200">Verifica tecnica richiesta</span>;
  }

  return <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-200">Operativo</span>;
}
