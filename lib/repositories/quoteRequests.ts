import { allDemoQuoteRequests, updateDemoQuoteRequestStatus } from "@/lib/demo-store";
import { fallback, fromSupabase, normalizeStatus, RepositoryResult } from "@/lib/repositories/shared";
import { createSupabaseAdminClient, createSupabaseAuthenticatedClient } from "@/lib/supabase/admin";
import { ChildGuest, QuoteRequest, QuoteStatus } from "@/lib/types";

export type QuoteRequestInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  destination?: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children?: { birthDate: string; firstName?: string }[];
  rooms: number;
  treatment?: string;
  message?: string;
  metadata?: Record<string, unknown>;
};

export async function listQuoteRequests(status?: QuoteStatus): Promise<RepositoryResult<QuoteRequest[]>> {
  const demoRequests = allDemoQuoteRequests();
  const local = status ? demoRequests.filter((request) => request.status === status) : demoRequests;
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(local);

  let query = supabase.from("quote_requests").select("*, quote_request_children(*)").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return fallback(local, error);
  return fromSupabase((data ?? []).map(mapQuoteRequest));
}

export async function listPendingQuoteRequests() {
  return listQuoteRequests("da_evadere");
}

export async function getQuoteRequestById(id: string): Promise<RepositoryResult<QuoteRequest | null>> {
  const local = allDemoQuoteRequests().find((request) => request.id === id) ?? null;
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(local);

  const { data, error } = await supabase.from("quote_requests").select("*, quote_request_children(*)").eq("id", id).maybeSingle();
  if (error) return fallback(local, error);
  return fromSupabase(data ? mapQuoteRequest(data) : null);
}

export async function createQuoteRequest(input: QuoteRequestInput): Promise<RepositoryResult<QuoteRequest | null>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(null, "Sistema non ancora configurato. Contatta il referente tecnico.");

  const { data, error } = await supabase
    .from("quote_requests")
    .insert({
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone,
      destination: input.destination,
      check_in: input.checkIn,
      check_out: input.checkOut,
      adults: input.adults,
      children_count: input.children?.length ?? 0,
      rooms: input.rooms,
      treatment: input.treatment,
      message: input.message,
      metadata: input.metadata ?? {}
    })
    .select("*")
    .single();

  if (error) return fallback(null, error);

  if (input.children?.length) {
    await supabase.from("quote_request_children").insert(input.children.map((child) => ({ quote_request_id: data.id, birth_date: child.birthDate })));
  }

  return getQuoteRequestById(data.id);
}

export async function updateQuoteRequestStatus(id: string, status: QuoteStatus, options: { accessToken?: string } = {}): Promise<RepositoryResult<QuoteRequest | null>> {
  const supabase = createSupabaseAuthenticatedClient(options.accessToken) ?? createSupabaseAdminClient();
  if (!supabase) return fallback(updateDemoQuoteRequestStatus(id, status));

  const { error } = await supabase.from("quote_requests").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return fallback(null, error);
  return getQuoteRequestById(id);
}

function mapQuoteRequest(row: Record<string, any>): QuoteRequest {
  const childRows = Array.isArray(row.quote_request_children) ? row.quote_request_children : [];
  const children: ChildGuest[] = childRows.map((child: Record<string, any>, index: number) => ({
    id: child.id,
    firstName: child.first_name ?? `Bambino ${index + 1}`,
    birthDate: child.birth_date
  }));

  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    destination: row.destination ?? "",
    arrivalDate: row.check_in,
    departureDate: row.check_out,
    adults: row.adults,
    children,
    rooms: row.rooms,
    requestedTreatment: row.treatment ?? undefined,
    message: row.message ?? undefined,
    receivedAt: row.created_at,
    status: normalizeStatus(row.status),
    requestedHotel: typeof row.metadata?.requested_hotel === "string" ? row.metadata.requested_hotel : undefined
  };
}
