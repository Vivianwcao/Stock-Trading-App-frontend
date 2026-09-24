import { useState, useEffect, useMemo } from "react";
import { api } from "./api";
import { translations } from "./i18n";
import AccountTabs from "./components/AccountTabs";

export default function App() {
  const [lang, setLang] = useState("en");
  const t = translations[lang];

  const [accounts, setAccounts] = useState([]);
  // stocks: {nickname: [{symbol, latest_date, holding}]}
  // Metadata only — no transactions. Transactions are fetched lazily per nickname in AccountTabs.
  const [stocks, setStocks] = useState({});
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

  // Single call: loads accounts, stock metadata, analysis, snapshots, last_fetched
  const loadPageData = async () => {
    const res = await api.onPageLoad();
    if (res.status === "success") {
      const d = res.data;
      setAccounts(d.accounts || []);
      setAnalysis(d.analysis || []);
      setSnapshots(d.snapshots || []);
      setLastFetched(d.last_fetched || []);
      // Group flat stocks array by nickname
      const rawStocks = d.stocks || [];
      const grouped = {};
      for (const s of rawStocks) {
        if (!s.nickname) continue;
        if (!grouped[s.nickname]) grouped[s.nickname] = [];
        grouped[s.nickname].push(s);
      }
      setStocks(grouped);
    } else {
      throw new Error(res.error || "Failed to load data");
    }
  };

  // Merge updated stock metadata for a nickname.
  // Called after update handlers return new stocks (updated symbols only).
  // Replaces matching symbols, keeps the rest.
  const mergeStocksByNickname = (nickname, updatedStocks) => {
    setStocks((prev) => {
      const existing = prev[nickname] || [];
      const updatedSyms = new Set(updatedStocks.map((s) => s.symbol));
      const kept = existing.filter((s) => !updatedSyms.has(s.symbol));
      return { ...prev, [nickname]: [...kept, ...updatedStocks] };
    });
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
          stocks={stocks}
          lastFetched={lastFetched}
          lang={lang}
          setLang={setLang}
          analysis={analysis}
          snapshots={snapshots}
          onMergeAnalysis={mergeAnalysisByAccountId}
          onMergeSnapshots={mergeSnapshotsByAccountId}
          onSetAccounts={setAccounts}
          onMergeStocks={mergeStocksByNickname}
          onUpdateLastFetched={updateLastFetchedEntry}
        />
      }
    </div>
  );
}
