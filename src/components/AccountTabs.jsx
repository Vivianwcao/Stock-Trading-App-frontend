import { useState, useMemo, useRef, useEffect } from "react";
import { api } from "../api";
import { fmtBalance, fmtVancouver } from "../utils/format";
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
];

export default function AccountTabs({
  t,
  accounts,
  grouped,
  lastFetched,
  lang,
  setLang,
  syncStatus,
  syncing,
  onSync,
  analysis,
  onSetAnalysis,
  onMergeTransactions,
  onUpdateLastFetched,
}) {
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

  const refreshOrders = async () => {
    if (!activeAccount?.id) return;
    setRefreshing(true);
    try {
      const res = await api.refreshOrders(activeAccount.id);
      setOrderStatus(res);
      if (res.status === "success") {
        // Transactions are returned directly — merge by account_id
        const freshTxns = res.data?.transactions || [];
        if (freshTxns.length > 0) {
          onMergeTransactions(activeAccount.id, freshTxns);
        }
        // fetched_at from backend is the activities timestamp for this account
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
      if (res.status === "success") {
        // Analysis rows returned directly
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
            return (
              <button
                key={acc.id}
                className={`account-tab ${acc.nickname === activeNick ? "active" : ""}`}
                onClick={() => setActiveNick(acc.nickname)}>
                <div className="tab-row-1">
                  <span className="tab-nickname">{acc.nickname}</span>
                  {hasToday && <span className="tab-new-badge">NEW</span>}
                  <span className="tab-balance">{fmtBalance(acc.balance)}</span>
                </div>
                <div className="tab-row-2">
                  <span className="tab-type">
                    {acc.account_type.replace(/_/g, " ").toUpperCase()}
                  </span>
                  <span className="tab-sync">
                    {acc.last_successful_sync ?
                      fmtVancouver(acc.last_successful_sync)
                    : "Never synced"}
                  </span>
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

      {/* ── RIGHT: utility panel (content changes per sub-tab) ── */}
      <div className="col-utility">
        {/* Sync button + language toggle (always visible) */}
        <div className="utility-top">
          <div className="utility-controls">
            <button
              className="btn btn-primary btn-sync"
              onClick={onSync}
              disabled={syncing}>
              {syncing ? t.syncing : t.syncActivities}
            </button>
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
          <div className="sync-status">
            {renderSyncStatus()}
            {actLastFetched && !syncing && (
              <span className="last-fetch-line">
                {t.lastSync}: {fmtVancouver(actLastFetched)}
              </span>
            )}
          </div>
        </div>

        {activeSubTab === "table" ?
          <>
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
        : /* Analysis mode: Refresh Positions + rank selector */
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
              <div className="sync-status">
                {renderPositionStatus()}
                {positionsLastSync && !positionsRefreshing && (
                  <span className="last-fetch-line">
                    {t.lastPositionsSync}: {fmtVancouver(positionsLastSync)}
                  </span>
                )}
              </div>
            </div>

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
