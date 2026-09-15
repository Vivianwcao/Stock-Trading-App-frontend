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
  getAccounts: () => call("get_all_accounts"),
  getTransactions: (accountIds = null) =>
    call("get_transactions", accountIds ? { account_ids: accountIds } : {}),
  syncActivities: () => call("update_all_activities"),
  refreshOrders: (account_id) =>
    call("update_orders_by_account", { account_id }),
  updateNickname: (account_id, nickname) =>
    call("update_nickname", { account_id, nickname }),
};
