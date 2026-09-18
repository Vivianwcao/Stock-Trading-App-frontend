import { useState, useMemo, useRef, useEffect } from "react";
import { api } from "../api";
import { fmtVancouver, fmtCAD } from "../utils/format";
import TransactionTable from "./TransactionTable";
import Calculator from "./Calculator";
import AnalysisTable from "./AnalysisTable";

function getLatestTradeDate(rows) {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].type === "BUY" || rows[i].type === "SELL") {
      return rows[i].trade_date;
    }
  }
  return null;
}

function getToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
  }).format(new Date());
}

const RANK_OPTIONS = [
  { key: "bought_ratio_rnk", labelKey: "rankBoughtRatio" },
  { key: "current_ratio_rnk", labelKey: "rankCurrentRatio" },
  { key: "bought_balance_rnk", labelKey: "rankBoughtBalance" },
  { key: "current_balance_rnk", labelKey: "rankCurrentBalance" },
  { key: "growth_percentage_rnk", labelKey: "rankGrowth" },
  { key: "cost_basis", labelKey: "rankCostBasis" },
];

export default function AccountTabs({
  t,
  accounts,
  grouped,
  lastFetched,
  lang,
  setLang,
  analysis,
  onSetAnalysis,
  onSetAccounts,
  onMergeTransactions,
  onUpdateLastFetched,
}) {
  const [utilityWidth, setUtilityWidth] = useState(270);

  const [activeNick, setActiveNick] = useState(
    () => accounts[0]?.nickname || null,
  );
  const [activeSym, setActiveSym] = useState(null);
  const [hypotheticals, setHypotheticals] = useState({});
  const [orderStatus, setOrderStatus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState("table");
  const [positionsRefreshing, setPositionsRefreshing] = useState(false);
  const [positionStatus, setPositionStatus] = useState(null);
  const [rankCol, setRankCol] = useState("bought_ratio_rnk");

  // Per-account sync state (replaces global sync in App.jsx)
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);

  // Reset per-account state when switching accounts (skip initial mount)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setActiveSym(null);
    setHypotheticals({});
    setOrderStatus(null);
    setRefreshing(false);
    setActiveSubTab("table");
    setPositionStatus(null);
    setPositionsRefreshing(false);
    setSyncStatus(null);
    setSyncing(false);
  }, [activeNick]);

  const activeAccount = accounts.find((a) => a.nickname === activeNick);
  const symbols = (activeNick && grouped[activeNick]) || {};

  const symbolList = useMemo(() => {
    return Object.keys(symbols).sort((a, b) => {
      const da = getLatestTradeDate(symbols[a]);
      const db = getLatestTradeDate(symbols[b]);
      if (!da && !db) return a.localeCompare(b);
      if (!da) return 1;
      if (!db) return -1;
      return db.localeCompare(da);
    });
  }, [symbols]);

  // Analysis rows filtered to the active account
  const analysisRows = useMemo(
    () => analysis.filter((r) => r.nickname === activeNick),
    [analysis, activeNick],
  );

  // Most recent activities fetch for the active account specifically
  const actLastFetched = useMemo(() => {
    if (!activeAccount?.id) return null;
    return (
      lastFetched.find(
        (r) =>
          r.api_source === "activities" && r.account_id === activeAccount.id,
      )?.fetched_at || null
    );
  }, [lastFetched, activeAccount]);

  // Most recent orders fetch for the active account
  const ordLastFetched = useMemo(() => {
    if (!activeAccount?.id) return null;
    return (
      lastFetched.find(
        (r) => r.api_source === "orders" && r.account_id === activeAccount.id,
      )?.fetched_at || null
    );
  }, [lastFetched, activeAccount]);

  const today = getToday();

  // All hooks above — safe to conditionally return now
  if (!accounts.length) return <div className="status-msg">{t.noData}</div>;

  const currentSym =
    symbolList.includes(activeSym) ? activeSym : symbolList[0] || null;
  const rows = currentSym ? symbols[currentSym] || [] : [];
  const lastRow = rows[rows.length - 1];
  const currentHyp = currentSym ? (hypotheticals[currentSym] ?? null) : null;

  const setHypothetical = (sym, row) => {
    setHypotheticals((prev) => ({ ...prev, [sym]: row }));
  };

  // Per-account sync activities
  const syncActivities = async () => {
    if (!activeAccount?.id) return;
    setSyncing(true);
    setSyncStatus(null);
    try {
      const res = await api.updateActivitiesByAccount(activeAccount.id);
      setSyncStatus(res);
      if (res.status === "success") {
        const ft = res.data?.fetched_at;
        const timestamp =
          ft?.fetched_at ?? (typeof ft === "string" ? ft : null);
        if (timestamp) {
          onUpdateLastFetched("activities", activeAccount.id, timestamp);
        }
        // Reload transactions for this account
        const txRes = await api.getTransactions();
        if (txRes.status === "success") {
          const acctTxns = (txRes.data || []).filter(
            (r) => r.account_id === activeAccount.id,
          );
          onMergeTransactions(activeAccount.id, acctTxns);
        }
        // Refresh accounts to update last_successful_sync on tabs
        const accRes = await api.getAccounts();
        if (accRes.status === "success") {
          onSetAccounts(accRes.data?.accounts || []);
        }
      }
    } catch (e) {
      setSyncStatus({ status: "fail", error: e.message });
    } finally {
      setSyncing(false);
    }
  };

  const refreshOrders = async () => {
    if (!activeAccount?.id) return;
    setRefreshing(true);
    try {
      const res = await api.refreshOrders(activeAccount.id);
      setOrderStatus(res);
      if (res.status === "success") {
        const freshTxns = res.data?.transactions || [];
        if (freshTxns.length > 0) {
          onMergeTransactions(activeAccount.id, freshTxns);
        }
        const ft = res.data?.fetched_at;
        const timestamp =
          ft?.fetched_at ?? (typeof ft === "string" ? ft : null);
        if (timestamp) {
          onUpdateLastFetched("activities", activeAccount.id, timestamp);
        }
      }
    } catch (e) {
      setOrderStatus({ status: "fail", error: e.message });
    } finally {
      setRefreshing(false);
    }
  };

  const refreshPositions = async () => {
    if (!activeAccount?.id) return;
    setPositionsRefreshing(true);
    try {
      const res = await api.refreshPositions(activeAccount.id);
      setPositionStatus(res);
      if (res.status === "success") {
        onSetAnalysis(res.data || []);
      }
    } catch (e) {
      setPositionStatus({ status: "fail", error: e.message });
    } finally {
      setPositionsRefreshing(false);
    }
  };

  const renderSyncStatus = () => {
    if (syncing && !syncStatus)
      return <span className="sync-msg syncing">{t.syncing}</span>;
    if (!syncStatus) return null;
    if (syncStatus.status === "success") {
      const msg =
        syncStatus.rowsUpdated != null ?
          t.rowsUpdated(syncStatus.rowsUpdated)
        : t.syncSuccess;
      return <span className="sync-msg ok">{msg}</span>;
    }
    if (syncStatus.status === "cooldown") {
      const {
        hours: h = 0,
        minutes: m = 0,
        seconds: s = 0,
      } = syncStatus.data || {};
      return (
        <span className="sync-msg cooldown">{t.syncCooldown(h, m, s)}</span>
      );
    }
    if (syncStatus.status === "fail")
      return <span className="sync-msg fail">{syncStatus.error}</span>;
    return null;
  };

  const renderOrderStatus = () => {
    if (refreshing)
      return <span className="sync-msg syncing">{t.refreshing}</span>;
    if (!orderStatus) return null;
    if (orderStatus.status === "success") {
      const n = orderStatus.data?.rows_updated;
      return (
        <span className="sync-msg ok">
          {n != null ? t.rowsUpdated(n) : t.ordersSuccess}
        </span>
      );
    }
    if (orderStatus.status === "cooldown") {
      const { seconds: s = 0 } = orderStatus.data || {};
      return <span className="sync-msg cooldown">{t.ordersCooldown(s)}</span>;
    }
    if (orderStatus.status === "fail")
      return <span className="sync-msg fail">{orderStatus.error}</span>;
    return null;
  };

  const renderPositionStatus = () => {
    if (positionsRefreshing)
      return <span className="sync-msg syncing">{t.refreshing}</span>;
    if (!positionStatus) return null;
    if (positionStatus.status === "success")
      return <span className="sync-msg ok">{t.positionsSynced}</span>;
    if (positionStatus.status === "cooldown") {
      const {
        hours: h = 0,
        minutes: m = 0,
        seconds: s = 0,
      } = positionStatus.data || {};
      return (
        <span className="sync-msg cooldown">
          {t.positionsCooldown(h, m, s)}
        </span>
      );
    }
    if (positionStatus.status === "fail")
      return <span className="sync-msg fail">{positionStatus.error}</span>;
    return null;
  };

  // last_successful_sync from the positions data for this account
  const positionsLastSync = analysisRows[0]?.last_successful_sync ?? null;

  // Analysis totals for the active account (same value on all rows for one account)
  const analysisTotalBought = analysisRows[0]?.total_bought ?? null;
  const analysisTotalCurrent = analysisRows[0]?.total_current ?? null;

  const handleDividerMouseDown = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = utilityWidth;
    const onMouseMove = (ev) => {
      const delta = startX - ev.clientX;
      setUtilityWidth(Math.max(200, Math.min(480, startWidth + delta)));
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div className="app-columns">
      {/* ── LEFT: account tabs + sub-tabs + content ── */}
      <div className="col-accounts">
        {/* Account tabs */}
        <div className="account-tabs">
          {accounts.map((acc) => {
            const accSymbols = grouped[acc.nickname] || {};
            const hasToday = Object.values(accSymbols).some((rows) =>
              rows.some((r) => r.trade_date?.slice(0, 10) === today),
            );

            // Determine which current value to show: analysis.total_current vs acc.balance
            // Use whichever has the more recent sync date
            const accAnalysis = analysis.filter(
              (r) => r.nickname === acc.nickname,
            );
            const tabTotalBought = accAnalysis[0]?.total_bought ?? null;
            const analysisCurrent = accAnalysis[0]?.total_current ?? null;
            const analysisSync = accAnalysis[0]?.last_successful_sync ?? null;
            const accountSync = acc.last_successful_sync ?? null;

            let currentValue, currentSyncDate;
            if (analysisSync && accountSync) {
              if (analysisSync > accountSync) {
                currentValue = analysisCurrent;
                currentSyncDate = analysisSync;
              } else {
                currentValue = acc.balance;
                currentSyncDate = accountSync;
              }
            } else if (analysisSync) {
              currentValue = analysisCurrent;
              currentSyncDate = analysisSync;
            } else {
              currentValue = acc.balance;
              currentSyncDate = accountSync;
            }

            return (
              <button
                key={acc.id}
                className={`account-tab ${acc.nickname === activeNick ? "active" : ""}`}
                onClick={() => setActiveNick(acc.nickname)}>
                <div className="tab-row-1">
                  <span className="tab-nickname">{acc.nickname}</span>
                  {hasToday && <span className="tab-new-badge">NEW</span>}
                  {tabTotalBought != null && (
                    <span className="tab-total-bought">
                      {fmtCAD(tabTotalBought)}
                    </span>
                  )}
                </div>
                <div className="tab-row-2">
                  <span className="tab-type">
                    {acc.account_type.replace(/_/g, " ").toUpperCase()}
                  </span>
                  <div className="tab-right-values">
                    <span className="tab-total-current">
                      {currentValue != null ? fmtCAD(currentValue) : "—"}
                    </span>
                    <span className="tab-sync">
                      {currentSyncDate ?
                        fmtVancouver(currentSyncDate)
                      : "Never synced"}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Sub-tabs: Table | Analysis */}
        <div className="sub-tabs">
          <button
            className={`sub-tab table-tab ${activeSubTab === "table" ? "active" : ""}`}
            onClick={() => setActiveSubTab("table")}>
            {t.tabTable}
          </button>
          <button
            className={`sub-tab analysis-tab ${activeSubTab === "analysis" ? "active" : ""}`}
            onClick={() => setActiveSubTab("analysis")}>
            {t.tabAnalysis}
          </button>
        </div>

        {/* Content area */}
        {activeSubTab === "table" ?
          symbolList.length === 0 ?
            <div className="status-msg">{t.noSymbols}</div>
          : <TransactionTable t={t} rows={rows} hypothetical={currentHyp} />
        : <AnalysisTable t={t} rows={analysisRows} rankCol={rankCol} />}
      </div>

      {/* ── DIVIDER ── */}
      <div className="col-divider" onMouseDown={handleDividerMouseDown} />

      {/* ── RIGHT: utility panel ── */}
      <div className="col-utility" style={{ width: utilityWidth }}>
        {/* Lang toggle — always visible */}
        <div className="utility-top">
          <div className="lang-toggle">
            <button
              className={`lang-btn ${lang === "en" ? "active" : ""}`}
              onClick={() => setLang("en")}>
              EN
            </button>
            <span className="lang-sep">|</span>
            <button
              className={`lang-btn ${lang === "zh" ? "active" : ""}`}
              onClick={() => setLang("zh")}>
              中文
            </button>
          </div>
        </div>

        {activeSubTab === "table" ?
          <>
            {/* Sync Activities section */}
            <div className="sync-section">
              <button
                className="btn btn-primary btn-sync"
                onClick={syncActivities}
                disabled={syncing}>
                {syncing ? t.syncing : t.syncActivities}
              </button>
              <div className="sync-status">
                {renderSyncStatus()}
                {actLastFetched && !syncing && (
                  <span className="last-fetch-line">
                    {t.lastSync}: {fmtVancouver(actLastFetched)}
                  </span>
                )}
              </div>
            </div>

            {/* Symbol tabs */}
            <div className="symbol-tabs-area">
              <div className="stock-tabs">
                {symbolList.map((sym) => {
                  const symRows = symbols[sym];
                  const last = symRows[symRows.length - 1];
                  const isHeld = last && last.holdings_per_cycle > 0;
                  const hasToday = symRows.some(
                    (r) => r.trade_date?.slice(0, 10) === today,
                  );
                  return (
                    <button
                      key={sym}
                      className={`stock-tab ${sym === currentSym ? "active" : ""} ${!isHeld ? "closed" : ""} ${hasToday ? "tab-today" : ""}`}
                      onClick={() => setActiveSym(sym)}>
                      {sym}
                      {isHeld && (
                        <span className="units-badge">
                          {last.holdings_per_cycle}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Calculator */}
            {currentSym && (
              <Calculator
                t={t}
                symbol={currentSym}
                lastRow={lastRow}
                ordersLastFetched={ordLastFetched}
                onCalculate={(row) => setHypothetical(currentSym, row)}
                onClear={() => setHypothetical(currentSym, null)}
                hasHypothetical={currentHyp !== null}
                onRefreshOrders={refreshOrders}
                refreshing={refreshing}
                renderOrderStatus={renderOrderStatus}
              />
            )}
          </>
        : /* Analysis mode: Refresh Positions + summary + rank selector */
          <div className="analysis-controls">
            <div className="analysis-refresh">
              <button
                className="btn btn-analysis"
                onClick={refreshPositions}
                disabled={positionsRefreshing}>
                {positionsRefreshing ?
                  t.refreshing
                : `${t.refreshPositions}: ${activeNick}`}
              </button>
              <div className="sync-status" style={{ marginTop: "4px" }}>
                {renderPositionStatus()}
                {positionsLastSync && !positionsRefreshing && (
                  <span className="last-fetch-line">
                    {t.lastPositionsSync}: {fmtVancouver(positionsLastSync)}
                  </span>
                )}
              </div>
            </div>

            {/* Account totals summary */}
            {(analysisTotalBought != null || analysisTotalCurrent != null) && (
              <div className="analysis-summary">
                {analysisTotalBought != null && (
                  <div className="analysis-summary-item">
                    <span className="analysis-summary-label">
                      {t.totalBought}
                    </span>
                    <strong className="analysis-summary-value neg">
                      {fmtCAD(analysisTotalBought)}
                    </strong>
                  </div>
                )}
                {analysisTotalCurrent != null && (
                  <div className="analysis-summary-item">
                    <span className="analysis-summary-label">
                      {t.totalCurrent}
                    </span>
                    <strong className="analysis-summary-value pos">
                      {fmtCAD(analysisTotalCurrent)}
                    </strong>
                  </div>
                )}
              </div>
            )}

            <div className="rank-selector">
              <span className="rank-label">{t.rankBy}</span>
              {RANK_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  className={`rank-btn ${rankCol === opt.key ? "active" : ""}`}
                  onClick={() => setRankCol(opt.key)}>
                  {t[opt.labelKey]}
                </button>
              ))}
            </div>
          </div>
        }
      </div>
    </div>
  );
}
