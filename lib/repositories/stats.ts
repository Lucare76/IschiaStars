import { countPendingQuoteRequests } from "@/lib/repositories/quoteRequests";
import { fallback, fromSupabase, RepositoryResult } from "@/lib/repositories/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTrackingExcludedIps } from "@/lib/server/trackingFilters";
import { RELIABLE_QUOTE_TRACKING_FROM } from "@/lib/follow-up-policy";

export type DashboardStats = {
  createdQuotes: number;
  pendingRequests: number;
  sentQuotes: number;
  expiredQuotes: number;
  openedQuotes: number;
  unopenedQuotes: number;
  confirmedQuotes: number;
  lostQuotes: number;
  conversionRate: number;
  whatsappClicks: number;
  confirmedValue: number;
  depositReceivedValue: number;
  repeatedlyViewedQuotes: number;
  hotCustomers: number;
};

type DashboardSummaryRow = {
  created_quotes: number;
  sent_quotes: number;
  expired_quotes: number;
  confirmed_quotes: number;
  lost_quotes: number;
  confirmed_value: number;
  opened_quotes: number;
  unopened_quotes: number;
  whatsapp_clicks: number;
  repeatedly_viewed: number;
  hot_customers: number;
};

export async function getDashboardStats(): Promise<RepositoryResult<DashboardStats>> {
  const empty = emptyDashboardStats();

  const [summaryResult, pendingCountResult] = await Promise.all([
    getDashboardSummaryFromRPC(),
    countPendingQuoteRequests()
  ]);

  if (summaryResult.error || pendingCountResult.error) {
    return fallback(empty, [summaryResult.error, pendingCountResult.error].filter(Boolean).join(" | "));
  }

  const s = summaryResult.data;

  return fromSupabase({
    createdQuotes: s.created_quotes,
    pendingRequests: pendingCountResult.data,
    sentQuotes: s.sent_quotes,
    expiredQuotes: s.expired_quotes,
    openedQuotes: s.opened_quotes,
    unopenedQuotes: s.unopened_quotes,
    confirmedQuotes: s.confirmed_quotes,
    lostQuotes: s.lost_quotes,
    conversionRate: s.created_quotes > 0
      ? Math.round((s.confirmed_quotes / s.created_quotes) * 100)
      : 0,
    whatsappClicks: s.whatsapp_clicks,
    confirmedValue: s.confirmed_value,
    depositReceivedValue: 0,
    repeatedlyViewedQuotes: s.repeatedly_viewed,
    hotCustomers: s.hot_customers
  });
}

async function getDashboardSummaryFromRPC(): Promise<RepositoryResult<DashboardSummaryRow>> {
  const empty = emptyDashboardSummaryRow();
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallback(empty);

  const { data, error } = await supabase
    .rpc("get_admin_dashboard_summary", {
      p_excluded_ips: getTrackingExcludedIps(),
      p_tracking_from: RELIABLE_QUOTE_TRACKING_FROM
    })
    .maybeSingle();

  if (error) return fallback(empty, error);

  const row = (data ?? {}) as Record<string, unknown>;
  return fromSupabase({
    created_quotes: Number(row.created_quotes ?? 0),
    sent_quotes: Number(row.sent_quotes ?? 0),
    expired_quotes: Number(row.expired_quotes ?? 0),
    confirmed_quotes: Number(row.confirmed_quotes ?? 0),
    lost_quotes: Number(row.lost_quotes ?? 0),
    confirmed_value: Number(row.confirmed_value ?? 0),
    opened_quotes: Number(row.opened_quotes ?? 0),
    unopened_quotes: Number(row.unopened_quotes ?? 0),
    whatsapp_clicks: Number(row.whatsapp_clicks ?? 0),
    repeatedly_viewed: Number(row.repeatedly_viewed ?? 0),
    hot_customers: Number(row.hot_customers ?? 0)
  });
}

function emptyDashboardSummaryRow(): DashboardSummaryRow {
  return {
    created_quotes: 0,
    sent_quotes: 0,
    expired_quotes: 0,
    confirmed_quotes: 0,
    lost_quotes: 0,
    confirmed_value: 0,
    opened_quotes: 0,
    unopened_quotes: 0,
    whatsapp_clicks: 0,
    repeatedly_viewed: 0,
    hot_customers: 0
  };
}

function emptyDashboardStats(): DashboardStats {
  return {
    createdQuotes: 0,
    pendingRequests: 0,
    sentQuotes: 0,
    expiredQuotes: 0,
    openedQuotes: 0,
    unopenedQuotes: 0,
    confirmedQuotes: 0,
    lostQuotes: 0,
    conversionRate: 0,
    whatsappClicks: 0,
    confirmedValue: 0,
    depositReceivedValue: 0,
    repeatedlyViewedQuotes: 0,
    hotCustomers: 0
  };
}
