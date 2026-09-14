import { useState, useEffect, useMemo } from "react";
import { api } from "./api";
import { translations } from "./i18n";
import AccountTabs from "./components/AccountTabs";

export default function App() {
  const [lang, setLang] = useState("en");
  const t = translations[lang];

  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [accountsBalance, setAccountsBalance] = useState([]);
  const [lastFetched, setLastFetched] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    Promise.all([loadAccounts(), loadTransactions()])
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // triggerSync(); — removed, user triggers manually
  }, []);

  const loadAccounts = async () => {
    const res = await api.getAccounts();
    if (res.status === "success") setAccounts(res.data);
  };

  const loadTransactions = async (accountIds = null) => {
    const res = await api.getTransactions(accountIds);
    if (res.status === "success") {
      setTransactions(res.transactions || []);
      setAccountsBalance(res.accounts_balance || []);
      setLastFetched(res.last_fetched || []);
    }
  };

  const triggerSync = async () => {
    setSyncing(true);
    try {
      const res = await api.syncActivities();
      if (res.status === "success") {
        const accountData = res.data || {};
        const successfulIds = Object.entries(accountData)
          .filter(([, v]) => v.status === "success")
          .map(([id]) => id);
        const rowsUpdated = Object.values(accountData)
          .filter((v) => v.status === "success")
          .reduce((s, v) => s + (v.data?.rows_updated || 0), 0);
        setSyncStatus({ status: "success", rowsUpdated });
        await Promise.all([
          loadAccounts(),
          loadTransactions(successfulIds.length ? successfulIds : null),
        ]);
      } else {
        setSyncStatus(res);
      }
    } catch (e) {
      setSyncStatus({ status: "fail", error: e.message });
    } finally {
      setSyncing(false);
    }
  };

  const grouped = useMemo(() => {
    const g = {};
    for (const row of transactions) {
      const nick = row.nickname;
      const sym = row.symbol;
      if (!nick || !sym) continue;
      if (!g[nick]) g[nick] = {};
      if (!g[nick][sym]) g[nick][sym] = [];
      g[nick][sym].push(row);
    }
    for (const nick of Object.keys(g)) {
      for (const sym of Object.keys(g[nick])) {
        g[nick][sym].sort((a, b) => a.trade_date.localeCompare(b.trade_date));
      }
    }
    return g;
  }, [transactions]);

  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.nickname && a.status === "open"),
    [accounts],
  );

  return (
    <div className="app">
      {loading ? (
        <div className="status-msg">{t.loading}</div>
      ) : error ? (
        <div className="status-msg error">{error}</div>
      ) : (
        <AccountTabs
          t={t}
          accounts={activeAccounts}
          grouped={grouped}
          accountsBalance={accountsBalance}
          lastFetched={lastFetched}
          lang={lang}
          setLang={setLang}
          syncStatus={syncStatus}
          syncing={syncing}
          onSync={triggerSync}
        />
      )}
    </div>
  );
}
