import { useState, useEffect, useMemo } from "react";
import { api, setPassword, clearPassword } from "./api";
import { translations } from "./i18n";
import AccountTabs from "./components/AccountTabs";
import PasswordGate from "./components/PasswordGate";

function getStoredPassword() {
  try {
    return sessionStorage.getItem("app_pw") || null;
  } catch {
    return null;
  }
}

export default function App() {
  const [lang, setLang] = useState("en");
  const t = translations[lang];

  // authenticated: true only after a successful loadPageData().
  // Gate stays visible until this is true.
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [gateLoading, setGateLoading] = useState(false);

  const [accounts, setAccounts] = useState([]);
  // stocks: {nickname: [{symbol, latest_date, holding}]}
  // Metadata only — no transactions. Transactions are fetched lazily per nickname in AccountTabs.
  const [stocks, setStocks] = useState({});
  const [lastFetched, setLastFetched] = useState([]);
  const [analysis, setAnalysis] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [error, setError] = useState(null);

  // Single call: loads accounts, stock metadata, analysis, snapshots, last_fetched.
  // Used as both the password verifier and the initial data loader.
  const loadPageData = async () => {
    const res = await api.onPageLoad();
    if (res.status === "success") {
      const d = res.data;
      setAccounts(d.accounts || []);
      setAnalysis(d.analysis || []);
      setSnapshots(d.snapshots || []);
      setLastFetched(d.last_fetched || []);
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

  // Attempt to authenticate with a given password.
  // Gate stays open the whole time — only closes on success.
  const attemptAuth = async (pwd) => {
    setPassword(pwd);
    setAuthError(null);
    setGateLoading(true);
    try {
      await loadPageData();
      // Success — persist and unlock
      try {
        sessionStorage.setItem("app_pw", pwd);
      } catch {}
      setAuthenticated(true);
    } catch (e) {
      clearPassword();
      if (e.unauthorized) {
        // 401: wrong password — clear stored password, show backend's message
        try {
          sessionStorage.removeItem("app_pw");
        } catch {}
        setAuthError(e.message);
      } else {
        // Network error, backend crash, etc. — keep stored password (may still be valid),
        // show what went wrong so the user knows it's not a password issue
        setAuthError(`Connection failed: ${e.message || "Failed to fetch"}`);
      }
    } finally {
      setGateLoading(false);
    }
  };

  // On mount: restore stored password and auto-verify (gate stays open during check)
  useEffect(() => {
    const stored = getStoredPassword();
    if (stored) attemptAuth(stored);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Called by PasswordGate on form submit
  const handleUnlock = (pwd) => attemptAuth(pwd);

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

  if (!authenticated) {
    return (
      <PasswordGate
        authError={authError}
        loading={gateLoading}
        onUnlock={handleUnlock}
      />
    );
  }

  return (
    <div className="app">
      {error ?
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
