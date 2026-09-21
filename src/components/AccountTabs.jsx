import { useState, useMemo, useRef, useEffect } from "react";
import { api } from "../api";
import { fmtVancouver, fmtCAD } from "../utils/format";
import TransactionTable from "./TransactionTable";
import Calculator from "./Calculator";
import AnalysisTable from "./AnalysisTable";
import AnalysisCharts from "./AnalysisCharts";

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
  { key: "bought_ratio", labelKey: "rankBoughtRatio" },
  { key: "current_ratio", labelKey: "rankCurrentRatio" },
  { key: "growth_percentage", labelKey: "rankGrowth" },
  { key: "cost_basis", labelKey: "rankCostBasis" },
];

// Default: last N scheduled snapshots selected on account switch
const DEFAULT_SNAPSHOT_COUNT = 20;

export default function AccountTabs({
  t,
  accounts,
  grouped,
  lastFetched,
  lang,
  setLang,
  analysis,
  snapshots,
  onMergeAnalysis,
  onMergeSnapshots,
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
  const [rankCol, setRankCol] = useState("bought_ratio");

  // Per-account sync state
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);

  // Snapshot comparison state
  const [selectedSnapshots, setSelectedSnapshots] = useState(new Set());
  const [showAllTriggers, setShowAllTriggers] = useState(true);
  const [comparisonData, setComparisonData] = useState([]);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [viewMode, setViewMode] = useState("latest"); // "latest" | "snapshot"

  const isInitialMount = useRef(true);
  // Cache for snapshot analysis data, keyed by sorted snapshot dates joined with ","
  // Snapshots are immutable (point-in-time), so caching is safe and avoids re-fetching
  const snapshotCacheRef = useRef({});

  // Reset per-account UI state when switching accounts (skip initial mount)
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
    setComparisonData([]);
    setComparisonLoading(false);
    setShowAllTriggers(true);
    setSelectedSnapshots(new Set());
    setShowCharts(false);
    setViewMode("latest");
    snapshotCacheRef.current = {}; // clear snapshot cache on account switch
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

  // All physical account IDs that belong to the active nickname group
  const nickAccIds = useMemo(
    () =>
      new Set(
        accounts.filter((a) => a.nickname === activeNick).map((a) => a.id),
      ),
    [accounts, activeNick],
  );

  // Analysis rows filtered to any physical account in the active nickname group
  const analysisRows = useMemo(
    () => analysis.filter((r) => nickAccIds.has(r.account_id)),
    [analysis, nickAccIds],
  );

  // All snapshots for this nickname group, sorted newest-first (ignores trigger filter)
  const allNickSnapshots = useMemo(
    () =>
      snapshots
        .filter((r) => nickAccIds.has(r.account_id))
        .sort((a, b) =>
          b.last_successful_sync.localeCompare(a.last_successful_sync),
        ),
    [snapshots, nickAccIds],
  );

  // Snapshots filtered by the trigger toggle (for the visible list)
  const accountSnapshots = useMemo(
    () =>
      allNickSnapshots.filter(
        (r) => showAllTriggers || r.trigger === "scheduled",
      ),
    [allNickSnapshots, showAllTriggers],
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
          onUpdateLastFetched("orders", activeAccount.id, timestamp);
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
      if (res.status === "success" || res.status === "partial") {
        const {
          analysis: freshAnalysis = [],
          sync_dates: freshSnapshots = [],
        } = res.data || {};
        onMergeAnalysis(activeAccount.id, freshAnalysis);
        onMergeSnapshots(activeAccount.id, freshSnapshots);
      }
    } catch (e) {
      setPositionStatus({ status: "fail", error: e.message });
    } finally {
      setPositionsRefreshing(false);
    }
  };

  // ── Snapshot selector helpers ────────────────────────────────────────────
  const toggleSnapshot = (syncDate) => {
    setSelectedSnapshots((prev) => {
      const next = new Set(prev);
      if (next.has(syncDate)) next.delete(syncDate);
      else next.add(syncDate);
      return next;
    });
  };

  const selectAllSnapshots = () => {
    setSelectedSnapshots(
      new Set(accountSnapshots.map((r) => r.last_successful_sync)),
    );
  };

  const clearAllSnapshots = () => {
    setSelectedSnapshots(new Set());
  };

  // Return to cached latest-cycle view
  const handleDefault = () => {
    setSelectedSnapshots(new Set());
    setComparisonData([]);
    setViewMode("latest");
    setShowCharts(false);
  };

  // Fetch data for the selected snapshot(s) — serves from in-memory cache when available
  const handleAnalyze = async () => {
    if (selectedSnapshots.size === 0) return;
    const selectedArr = [...selectedSnapshots].sort();
    const cacheKey = selectedArr.join(",");

    // Snapshots are immutable; serve from cache on repeat access
    if (snapshotCacheRef.current[cacheKey]) {
      setComparisonData(snapshotCacheRef.current[cacheKey]);
      setViewMode("snapshot");
      if (selectedArr.length > 1) setShowCharts(true);
      return;
    }

    const snapshotAccountId =
      allNickSnapshots.find((s) => selectedArr.includes(s.last_successful_sync))
        ?.account_id ?? activeAccount?.id;
    if (!snapshotAccountId) return;

    setComparisonLoading(true);
    setComparisonData([]);
    try {
      const res =
        selectedArr.length === 1 ?
          await api.getAnalysisBySnapshot(snapshotAccountId, selectedArr[0])
        : await api.compareAnalysisAcrossSnapshots(
            snapshotAccountId,
            selectedArr,
          );
      if (res.status === "success") {
        const freshData = res.data || [];
        snapshotCacheRef.current[cacheKey] = freshData; // populate cache
        setComparisonData(freshData);
        setViewMode("snapshot");
        if (selectedArr.length > 1) setShowCharts(true);
      }
    } catch (e) {
      // leave comparisonData empty; user sees empty state
    } finally {
      setComparisonLoading(false);
    }
  };

  // ── Chart section navigator ──────────────────────────────────────────────
  const scrollToChart = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ── Status renderers ──────────────────────────────────────────────────────
  const renderSyncStatus = () => {
    if (syncing && !syncStatus)
      return <span className="sync-msg syncing">{t.syncing}</span>;
    if (!syncStatus) return null;
    if (syncStatus.status === "success") {
      const n = syncStatus.data?.rows_updated;
      const msg = n != null ? t.rowsUpdated(n) : t.syncSuccess;
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
    if (positionStatus.status === "partial")
      return (
        <span className="sync-msg warn">
          {t.positionsPartial ?? "API rate limited — showing cached data"}
          {positionStatus.error ? `: ${positionStatus.error}` : ""}
        </span>
      );
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

  // last_successful_sync from the analysis rows for this account
  const positionsLastSync = analysisRows[0]?.last_successful_sync ?? null;

  // Analysis totals — from cached rows in latest mode, from loaded data in single-snapshot mode
  const analysisTotalBought = analysisRows[0]?.total_bought ?? null;
  const analysisTotalCurrent = analysisRows[0]?.total_current ?? null;

  const summaryBought =
    viewMode === "latest" ? analysisTotalBought : (
      (comparisonData[0]?.total_bought ?? null)
    );
  const summaryCurrent =
    viewMode === "latest" ? analysisTotalCurrent : (
      (comparisonData[0]?.total_current ?? null)
    );
  // Show summary in latest mode and single-snapshot mode; hide in multi-snapshot compare
  const showSummary =
    selectedSnapshots.size <= 1 &&
    (summaryBought != null || summaryCurrent != null);

  // Data to render — cached analysis rows in "latest" mode, fetched data in "snapshot" mode
  const activeChartData = viewMode === "latest" ? analysisRows : comparisonData;
  const activeTableRows = viewMode === "latest" ? analysisRows : comparisonData;

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

            // Filter analysis by account_id (not nickname)
            const accAnalysis = analysis.filter((r) => r.account_id === acc.id);
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

        {/* Sub-tabs: Table | Analysis + active symbol label */}
        <div className="sub-tabs-row">
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
          {activeSubTab === "table" && currentSym && (
            <span className="subtab-active-sym">{currentSym}</span>
          )}
          {activeSubTab === "analysis" &&
            viewMode === "snapshot" &&
            selectedSnapshots.size > 0 && (
              <span className="subtab-active-sym">
                {selectedSnapshots.size === 1 ?
                  [...selectedSnapshots][0].slice(0, 10)
                : `${selectedSnapshots.size} ${t.snapshotsSelected ?? "snapshots"}`
                }
              </span>
            )}
        </div>

        {/* Content area — scrollable so charts don't get clipped */}
        <div className="content-scroll">
          {activeSubTab === "table" ?
            symbolList.length === 0 ?
              <div className="status-msg">{t.noSymbols}</div>
            : <TransactionTable t={t} rows={rows} hypothetical={currentHyp} />
          : /* Analysis sub-tab */
          comparisonLoading ?
            <div className="status-msg">{t.loading}</div>
          : showCharts ?
            <AnalysisCharts t={t} data={activeChartData} rankCol={rankCol} />
          : <AnalysisTable t={t} rows={activeTableRows} rankCol={rankCol} />}
        </div>
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
                {syncing ? t.syncing : `${t.syncActivities}: ${activeNick}`}
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
                nickname={activeNick}
              />
            )}
          </>
        : /* Analysis mode: Refresh Positions + snapshot selector + rank */
          <div className="analysis-controls">
            {/* Refresh Positions button */}
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

            {/* Account totals summary — latest mode or single snapshot */}
            {showSummary && (
              <div className="analysis-summary">
                {summaryBought != null && (
                  <div className="analysis-summary-item">
                    <span className="analysis-summary-label">
                      {t.totalBought}
                    </span>
                    <strong className="analysis-summary-value neg">
                      {fmtCAD(summaryBought)}
                    </strong>
                  </div>
                )}
                {summaryCurrent != null && (
                  <div className="analysis-summary-item">
                    <span className="analysis-summary-label">
                      {t.totalCurrent}
                    </span>
                    <strong className="analysis-summary-value pos">
                      {fmtCAD(summaryCurrent)}
                    </strong>
                  </div>
                )}
              </div>
            )}

            {/* ── View mode: Latest Cycle vs Snapshot(s) ────────────────── */}
            <div className="analysis-mode-toggle">
              <button
                className={`mode-btn ${viewMode === "latest" ? "active" : ""}`}
                onClick={handleDefault}>
                {t.latestCycle ?? "Latest Cycle"}
              </button>
              <button
                className={`mode-btn ${viewMode === "snapshot" ? "active" : ""}`}
                onClick={() => setViewMode("snapshot")}>
                {t.snapshotMode ?? "Snapshot(s)"}
                {selectedSnapshots.size > 0 && ` (${selectedSnapshots.size})`}
              </button>
            </div>

            {/* ── Table / Charts toggle ─────────────────────────────────── */}
            <div className="chart-view-toggle">
              <button
                className={`chart-view-opt ${!showCharts ? "active" : ""}`}
                disabled={viewMode === "snapshot" && selectedSnapshots.size > 1}
                onClick={() => setShowCharts(false)}>
                ☰ {t.viewTable ?? "Table"}
              </button>
              <button
                className={`chart-view-opt ${showCharts ? "active" : ""}`}
                onClick={() => setShowCharts(true)}>
                ▦ {t.viewCharts ?? "Charts"}
              </button>
            </div>

            {/* ── Load Analysis — above snapshot list for quick access ───── */}
            {viewMode === "snapshot" && (
              <button
                className="snapshot-load-btn"
                onClick={handleAnalyze}
                disabled={selectedSnapshots.size === 0 || comparisonLoading}>
                {comparisonLoading ?
                  (t.loading ?? "Loading…")
                : (t.loadSnapshot ?? "Load Analysis")}
              </button>
            )}

            {/* ── Chart nav — jump to each chart section ────────────────── */}
            {showCharts && (
              <div className="chart-nav">
                <span className="chart-nav-label">
                  {t.navJumpTo ?? "Jump to"}
                </span>
                <button
                  className="chart-nav-btn"
                  onClick={() => scrollToChart("chart-growth")}>
                  {t.navChartGrowth ?? "① Growth %"}
                </button>
                <button
                  className="chart-nav-btn"
                  onClick={() => scrollToChart("chart-allocation")}>
                  {t.navChartAllocation ?? "② Allocation"}
                </button>
                <button
                  className="chart-nav-btn"
                  onClick={() => scrollToChart("chart-value")}>
                  {t.navChartValue ?? "③ Position Value"}
                </button>
              </div>
            )}

            {/* Rank selector — only relevant for table view */}
            {!showCharts && (
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
            )}

            {/* ── Snapshot selector — only in snapshot mode ─────────────── */}
            {viewMode === "snapshot" && allNickSnapshots.length > 0 && (
              <div className="snapshot-selector">
                <div className="snapshot-header">
                  <span className="snapshot-label">
                    {t.snapshots ?? "Snapshots"}
                    {selectedSnapshots.size > 0 &&
                      ` (${selectedSnapshots.size})`}
                  </span>
                  <div className="snapshot-trigger-toggle">
                    <button
                      className={`trigger-btn ${!showAllTriggers ? "active" : ""}`}
                      onClick={() => setShowAllTriggers(false)}>
                      {t.scheduled ?? "Scheduled"}
                    </button>
                    <button
                      className={`trigger-btn ${showAllTriggers ? "active" : ""}`}
                      onClick={() => setShowAllTriggers(true)}>
                      {t.allTriggers ?? "All"}
                    </button>
                  </div>
                </div>

                {comparisonData.length === 0 && !comparisonLoading && (
                  <div className="snapshot-hint">
                    {t.snapshotHint ??
                      "Select one or more snapshots, then click Load."}
                  </div>
                )}

                <div className="snapshot-list">
                  {accountSnapshots.length === 0 ?
                    <div className="snapshot-empty">
                      {t.noScheduledSnapshots ?? "No scheduled snapshots"}
                    </div>
                  : accountSnapshots.map((s) => {
                      const checked = selectedSnapshots.has(
                        s.last_successful_sync,
                      );
                      const isManual = s.trigger === "manual";
                      return (
                        <label
                          key={s.last_successful_sync}
                          className={`snapshot-item ${checked ? "checked" : ""}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              toggleSnapshot(s.last_successful_sync)
                            }
                          />
                          <span className="snapshot-date">
                            {s.last_successful_sync.slice(0, 10)}
                          </span>
                          <span
                            className={`snapshot-trigger-badge ${isManual ? "manual" : "scheduled"}`}>
                            {isManual ?
                              (t.triggerManual ?? "Manual")
                            : (t.triggerScheduled ?? "Scheduled")}
                          </span>
                        </label>
                      );
                    })
                  }
                </div>
              </div>
            )}
          </div>
        }
      </div>
    </div>
  );
}
