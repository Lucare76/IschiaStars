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
  children?: { birthDate?: string; age?: number; firstName?: string }[];
  rooms: number;
  treatment?: string;
  message?: string;
  receivedAt?: string;
  metadata?: Record<string, unknown>;
};

export async function listQuoteRequests(status?: QuoteStatus): Promise<RepositoryResult<QuoteRequest[]>> {
  const demoRequests = allDemoQuoteRequests();
  const local = status ? demoRequests.filter((request) => request.status === status) : demoRequests;
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(local);

  let query = supabase.from("quote_requests").select("*, quote_request_children(*)").order("created_at", { ascending: false });
  query = query.is("deleted_at", null);
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

  const { data, error } = await supabase.from("quote_requests").select("*, quote_request_children(*)").eq("id", id).is("deleted_at", null).maybeSingle();
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
      received_at: input.receivedAt ?? null,
      metadata: input.metadata ?? {}
    })
    .select("*")
    .single();

  if (error) return fallback(null, error);

  if (input.children?.length) {
    await supabase.from("quote_request_children").insert(
      input.children.map((child) => ({
        quote_request_id: data.id,
        birth_date: child.birthDate || null,
        age: child.age ?? null
      }))
    );
  }

  return getQuoteRequestById(data.id);
}

export async function deleteQuoteRequest(id: string): Promise<RepositoryResult<{ deleted: boolean }>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback({ deleted: false }, "Database non configurato");

  const existing = await supabase
    .from("quote_requests")
    .select("id, metadata")
    .eq("id", id)
    .maybeSingle();
  if (existing.error) return fallback({ deleted: false }, existing.error);
  if (!existing.data) return fromSupabase({ deleted: true });

  const now = new Date().toISOString();
  const { error } = await supabase.from("quote_requests").update({
    deleted_at: now,
    deleted_by: "admin",
    delete_reason: "deleted_from_backoffice",
    updated_at: now
  }).eq("id", id);
  if (error) return fallback({ deleted: false }, error);

  const metadata = (existing.data as { metadata?: Record<string, unknown> | null }).metadata ?? {};
  const gmailMessageId = typeof metadata.gmail_message_id === "string" ? metadata.gmail_message_id : null;
  if (gmailMessageId) {
    await supabase
      .from("email_import_ledger")
      .update({
        status: "deleted_by_admin",
        quote_request_id: id,
        metadata: {
          deleted_by_admin: true,
          deleted_at: now
        },
        updated_at: now
      })
      .eq("gmail_message_id", gmailMessageId);

    await supabase
      .from("inbound_emails")
      .update({
        status: "skipped",
        skipped_reason: "deleted_by_admin",
        updated_at: now
      })
      .eq("gmail_message_id", gmailMessageId);
  }

  await supabase
    .from("email_import_ledger")
    .update({
      status: "deleted_by_admin",
      metadata: {
        deleted_by_admin: true,
        deleted_at: now
      },
      updated_at: now
    })
    .eq("quote_request_id", id);

  return fromSupabase({ deleted: true });
}

/** Returns true if a quote_request with same email+checkIn was created in the last 7 days. Used to prevent duplicate imports from Gmail. */
export async function isDuplicateQuoteRequest(email: string, checkIn: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  if (!supabase || !email || !checkIn) return false;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("quote_requests")
    .select("id")
    .eq("email", email)
    .eq("check_in", checkIn)
    .is("deleted_at", null)
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
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
    birthDate: child.birth_date ?? "",
    age: child.age != null ? Number(child.age) : undefined
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
    receivedAt: row.received_at ?? row.created_at,
    importedAt: row.created_at,
    status: normalizeStatus(row.status),
    requestedHotel: typeof row.metadata?.requested_hotel === "string" ? row.metadata.requested_hotel : undefined
  };
}
