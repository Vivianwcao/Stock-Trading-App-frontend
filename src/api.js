// All API calls in one place.
// For local: VITE_API_URL=http://localhost:8000 (default)
// For Lambda: set VITE_API_URL=https://your-api-gateway-url in .env.production

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function call(action, data = {}) {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, data }),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body?.detail || body?.error || body?.message || detail;
    } catch (_) {}
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  // Initial load: accounts + stock metadata + analysis + snapshots + last_fetched
  // No transactions — fetched on demand per nickname
  onPageLoad: () => call("on_page_load"),

  // Sync flow: update accounts, then per-account activities, then full tx refresh
  updateAndGetAccounts: () => call("update_and_get_accounts"),
  updateActivitiesByAccount: (account_id) =>
    call("update_activities_by_account", { account_id }),

  // Lazy load: fetch all transactions for a nickname's active stocks on demand
  // stocks: string[] of symbol names to fetch
  getTransactionsByNickname: (nickname) =>
    call("get_transactions_on_recent_active_stocks_by_nickname", { nickname }),

  // Per-symbol: returns updated stocks metadata + transactions for changed symbols
  refreshOrders: (account_id) =>
    call("update_orders_and_get_transactions_by_account", { account_id }),

  // Per-account: returns { sync_dates, analysis } — may be "partial" if API rate-limited
  refreshPositions: (account_id) =>
    call("update_positions_and_get_latest_analysis_by_account", { account_id }),

  getAccounts: () => call("get_all_accounts"),

  updateNickname: (account_id, nickname) =>
    call("update_nickname", { account_id, nickname }),

  // Analysis: single snapshot for one account
  getAnalysisBySnapshot: (account_id, sync_date) =>
    call("get_analysis_by_account_by_snapshot", { account_id, sync_date }),

  // Analysis: compare multiple snapshots for one account
  compareAnalysisAcrossSnapshots: (account_id, sync_dates) =>
    call("compare_analysis_by_account_across_snapshots", {
      account_id,
      sync_dates,
    }),
};
