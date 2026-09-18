import { useState, useEffect, useMemo } from "react";
import { api } from "./api";
import { translations } from "./i18n";
import AccountTabs from "./components/AccountTabs";

export default function App() {
  const [lang, setLang] = useState("en");
  const t = translations[lang];

  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [lastFetched, setLastFetched] = useState([]);
  const [analysis, setAnalysis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadPageData()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Single call: loads accounts, transactions, analysis, last_fetched together
  const loadPageData = async () => {
    const res = await api.onPageLoad();
    if (res.status === "success") {
      const d = res.data;
      setAccounts(d.accounts || []);
      setTransactions(d.transactions || []);
      setAnalysis(d.analysis || []);
      setLastFetched(d.last_fetched || []);
    } else {
      throw new Error(res.error || "Failed to load data");
    }
  };

  // Full transactions refresh (called after sync completes)
  const loadTransactions = async () => {
    const res = await api.getTransactions();
    if (res.status === "success") {
      setTransactions(res.data || []);
    }
  };

  const triggerSync = async () => {
    setSyncing(true);
    setSyncStatus(null);
    try {
      // Step 1: update accounts — proceed even on cooldown (data still fresh)
      const accountsRes = await api.updateAndGetAccounts();
      const freshAccounts =
        accountsRes.status === "success"
          ? accountsRes.data?.accounts || []
          : accounts;
      if (accountsRes.status === "success") {
        setAccounts(freshAccounts);
      }

      const toUpdate = freshAccounts.filter(
        (a) => a.nickname && a.status === "open",
      );

      // Step 2: per-account activities update with 22s gap between accounts
      for (let i = 0; i < toUpdate.length; i++) {
        const acct = toUpdate[i];
        const res = await api.updateActivitiesByAccount(acct.id);
        if (res.status === "success") {
          setSyncStatus({ status: "success", rowsUpdated: res.data?.rows_updated || 0 });
          // fetched_at is {account_id, fetched_at} after backend bug fix
          const ft = res.data?.fetched_at;
          const timestamp =
            ft?.fetched_at ?? (typeof ft === "string" ? ft : null);
          if (timestamp) {
            setLastFetched((prev) => [
              ...prev.filter(
                (r) =>
                  !(
                    r.api_source === "activities" && r.account_id === acct.id
                  ),
              ),
              {
                api_source: "activities",
                account_id: acct.id,
                fetched_at: timestamp,
              },
            ]);
          }
        } else if (res.status === "cooldown") {
          setSyncStatus({ status: "cooldown", data: res.data });
        }
        // Wait 22s between accounts (backend enforces 20s cooldown; 2s buffer)
        if (i < toUpdate.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 22000));
        }
      }

      // Step 3: reload transactions + re-fetch accounts to refresh last_successful_sync on tabs
      await loadTransactions();
      const accRes = await api.getAccounts();
      if (accRes.status === "success") {
        setAccounts(accRes.data?.accounts || []);
      }
    } catch (e) {
      setSyncStatus({ status: "fail", error: e.message });
    } finally {
      setSyncing(false);
    }
  };

  // Merge fresh transactions for one account_id into global state
  const mergeTransactionsByAccountId = (accountId, freshTxns) => {
    setTransactions((prev) => [
      ...prev.filter((r) => r.account_id !== accountId),
      ...freshTxns,
    ]);
  };

  // Update a single last_fetched entry in state
  const updateLastFetchedEntry = (apiSource, accountId, fetchedAt) => {
    setLastFetched((prev) => [
      ...prev.filter(
        (r) => !(r.api_source === apiSource && r.account_id === accountId),
      ),
      { api_source: apiSource, account_id: accountId, fetched_at: fetchedAt },
    ]);
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
      {loading ?
        <div className="status-msg">{t.loading}</div>
      : error ?
        <div className="status-msg error">{error}</div>
      : <AccountTabs
          t={t}
          accounts={activeAccounts}
          grouped={grouped}
          lastFetched={lastFetched}
          lang={lang}
          setLang={setLang}
          syncStatus={syncStatus}
          syncing={syncing}
          onSync={triggerSync}
          analysis={analysis}
          onSetAnalysis={setAnalysis}
          onMergeTransactions={mergeTransactionsByAccountId}
          onUpdateLastFetched={updateLastFetchedEntry}
        />
      }
    </div>
  );
}
