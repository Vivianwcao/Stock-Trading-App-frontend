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
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPageData()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Single call: loads accounts, transactions, analysis, snapshots, last_fetched together
  const loadPageData = async () => {
    const res = await api.onPageLoad();
    if (res.status === "success") {
      const d = res.data;
      setAccounts(d.accounts || []);
      setTransactions(d.transactions || []);
      setAnalysis(d.analysis || []);
      setSnapshots(d.snapshots || []);
      setLastFetched(d.last_fetched || []);
    } else {
      throw new Error(res.error || "Failed to load data");
    }
  };

  // Merge fresh transactions for one account_id into global state
  const mergeTransactionsByAccountId = (accountId, freshTxns) => {
    setTransactions((prev) => [
      ...prev.filter((r) => r.account_id !== accountId),
      ...freshTxns,
    ]);
  };

  // Replace analysis rows for one account_id (used after refreshPositions)
  const mergeAnalysisByAccountId = (accountId, freshAnalysis) => {
    setAnalysis((prev) => [
      ...prev.filter((r) => r.account_id !== accountId),
      ...freshAnalysis,
    ]);
  };

  // Replace snapshot rows for one account_id (used after refreshPositions)
  const mergeSnapshotsByAccountId = (accountId, freshSnapshots) => {
    setSnapshots((prev) => [
      ...prev.filter((r) => r.account_id !== accountId),
      ...freshSnapshots,
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
          analysis={analysis}
          snapshots={snapshots}
          onMergeAnalysis={mergeAnalysisByAccountId}
          onMergeSnapshots={mergeSnapshotsByAccountId}
          onSetAccounts={setAccounts}
          onMergeTransactions={mergeTransactionsByAccountId}
          onUpdateLastFetched={updateLastFetchedEntry}
        />
      }
    </div>
  );
}
