import { recordQuoteStatusEvent } from "@/lib/demo-store";
import { fallback, fromSupabase, RepositoryResult } from "@/lib/repositories/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type QuoteStatusEventInput = {
  quoteId: string;
  fromStatus?: string | null;
  toStatus: string;
  note?: string;
};

export async function createQuoteStatusEvent(input: QuoteStatusEventInput): Promise<RepositoryResult<{ id?: string } | null>> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return fallback(recordQuoteStatusEvent(input.quoteId, input.fromStatus, input.toStatus, input.note));
  }

  const { data, error } = await supabase
    .from("quote_status_events")
    .insert({
      quote_id: input.quoteId,
      from_status: input.fromStatus ?? null,
      to_status: input.toStatus,
      note: input.note
    })
    .select("id")
    .single();

  if (error) return fallback(null, error);
  return fromSupabase(data);
}
