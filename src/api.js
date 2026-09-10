// All API calls in one place.
// For local: VITE_API_URL=http://localhost:8000 (default)
// For Lambda: set VITE_API_URL=https://your-api-gateway-url in .env.production

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function call(action, data = {}) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export const api = {
  getAccounts:     ()                        => call('get_all_account'),
  getTransactions: (data = {})               => call('get_transactions', data),
  syncActivities:  ()                        => call('update_all_activities'),
  refreshOrders:   (account_id)              => call('update_orders_by_account', { account_id }),
  updateNickname:  (account_id, nickname)    => call('update_nickname', { account_id, nickname }),
};
