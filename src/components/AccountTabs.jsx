import { useState, useMemo, useRef, useEffect } from "react";
import { api } from "../api";
import { fmtBalance, fmtVancouver } from "../utils/format";
import TransactionTable from "./TransactionTable";
import Calculator from "./Calculator";

function getToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
  }).format(new Date());
}

function getLatestTradeDate(rows) {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].type === "BUY" || rows[i].type === "SELL") {
      return rows[i].trade_date;
    }
  }
  return null;
}

export default function AccountTabs({
  t,
  accounts,
  grouped,
  lang,
  setLang,
  syncStatus,
  syncing,
  onSync,
}) {
  const [activeNick, setActiveNick] = useState(
    () => accounts[0]?.nickname || null,
  );
  const [activeSym, setActiveSym] = useState(null);
  const [hypotheticals, setHypotheticals] = useState({});
  const [orderStatus, setOrderStatus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

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
    } catch (e) {
      setOrderStatus({ status: "fail", error: e.message });
    } finally {
      setRefreshing(false);
    }
  };

  const renderSyncStatus = () => {
    if (syncing) return <span className="sync-msg syncing">{t.syncing}</span>;
    if (!syncStatus) return null;
    if (syncStatus.status === "success")
      return <span className="sync-msg ok">{t.syncSuccess}</span>;
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

  return (
    <div className="app-columns">
      {/* ── LEFT: account tabs + transaction table ── */}
      <div className="col-accounts">
        <div className="account-tabs">
          {accounts.map((acc) => (
            <button
              key={acc.id}
              className={`account-tab ${acc.nickname === activeNick ? "active" : ""}`}
              onClick={() => setActiveNick(acc.nickname)}>
              <div className="tab-row-1">
                <span className="tab-nickname">{acc.nickname}</span>
                {Object.values(grouped[acc.nickname] || {}).some((rows) =>
                  rows.some((r) => r.trade_date?.slice(0, 10) === today),
                ) && <span className="tab-new-badge">NEW</span>}
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
          ))}
        </div>

        {symbolList.length === 0 ?
          <div className="status-msg">{t.noSymbols}</div>
        : <TransactionTable t={t} rows={rows} hypothetical={currentHyp} />}
      </div>

      {/* ── RIGHT: sync controls + symbol tabs + calculator ── */}
      <div className="col-utility">
        {/* Sync button + language toggle */}
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
          <div className="sync-status">{renderSyncStatus()}</div>
        </div>

        {/* Symbol tabs */}
        <div className="symbol-tabs-area">
          <div className="stock-tabs">
            {symbolList.map((sym) => {
              const symRows = symbols[sym];
              const last = symRows[symRows.length - 1];
              const isHeld = last && last.rolling_units > 0;
              return (
                <button
                  key={sym}
                  className={`stock-tab ${sym === currentSym ? "active" : ""} ${!isHeld ? "closed" : ""} ${symRows.some((r) => r.trade_date?.slice(0, 10) === today) ? "tab-today" : ""}`}
                  onClick={() => setActiveSym(sym)}>
                  {sym}
                  {isHeld && (
                    <span className="units-badge">{last.rolling_units}</span>
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
            onCalculate={(row) => setHypothetical(currentSym, row)}
            onClear={() => setHypothetical(currentSym, null)}
            hasHypothetical={currentHyp !== null}
            onRefreshOrders={refreshOrders}
            refreshing={refreshing}
            orderStatus={orderStatus}
          />
        )}
      </div>
    </div>
  );
}
