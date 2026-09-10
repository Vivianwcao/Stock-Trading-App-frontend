import { useState, useMemo } from 'react';
import { api } from '../api';
import TransactionTable from './TransactionTable';
import Calculator from './Calculator';

// Find the most recent BUY or SELL date for a symbol's rows (already sorted asc)
function getLatestTradeDate(rows) {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].type === 'BUY' || rows[i].type === 'SELL') {
      return rows[i].trade_date;
    }
  }
  return null; // dividend-only or no real trades
}

export default function StockPanel({ t, nickname, accountId, symbols }) {
  // Sort symbols by most recent BUY/SELL date descending; ties sorted alphabetically
  const symbolList = useMemo(() => {
    return Object.keys(symbols).sort((a, b) => {
      const da = getLatestTradeDate(symbols[a]);
      const db = getLatestTradeDate(symbols[b]);
      if (!da && !db) return a.localeCompare(b);
      if (!da) return 1;
      if (!db) return -1;
      return db.localeCompare(da); // descending date (ISO strings sort correctly)
    });
  }, [symbols]);

  const [activeSym, setActiveSym] = useState(() => symbolList[0] || null);
  const [orderStatus, setOrderStatus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Single hypothetical row per symbol: { [sym]: row | null }
  const [hypotheticals, setHypotheticals] = useState({});

  const setHypothetical = (sym, row) => {
    setHypotheticals((prev) => ({ ...prev, [sym]: row }));
  };

  const refreshOrders = async () => {
    if (!accountId) return;
    setRefreshing(true);
    try {
      const res = await api.refreshOrders(accountId);
      setOrderStatus(res);
    } catch (e) {
      setOrderStatus({ status: 'fail', error: e.message });
    } finally {
      setRefreshing(false);
    }
  };

  if (!symbolList.length) return <div className="status-msg">{t.noSymbols}</div>;

  // Guard: active symbol may not exist after account switch (remount handles it, but be safe)
  const currentSym = symbolList.includes(activeSym) ? activeSym : symbolList[0];
  const rows = symbols[currentSym] || [];
  const lastRow = rows[rows.length - 1]; // most recent real row
  const currentHyp = hypotheticals[currentSym] ?? null;

  const symbolTabs = symbolList.map((sym) => {
    const symRows = symbols[sym];
    const last = symRows[symRows.length - 1];
    const isHeld = last && last.rolling_units > 0;
    return (
      <button
        key={sym}
        className={`stock-tab ${sym === currentSym ? 'active' : ''} ${!isHeld ? 'closed' : ''}`}
        onClick={() => setActiveSym(sym)}
      >
        {sym}
        {isHeld && (
          <span className="units-badge">{last.rolling_units}</span>
        )}
      </button>
    );
  });

  return (
    <div className="stock-panel">
      <div className="content-columns">
        {/* Left: transaction table fills available height */}
        <div className="col-left">
          <TransactionTable
            t={t}
            rows={rows}
            hypothetical={currentHyp}
          />
        </div>

        {/* Right: symbol tabs + calculator */}
        <div className="col-right">
          <div className="symbol-tabs-area">
            <div className="stock-tabs">{symbolTabs}</div>
          </div>
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
        </div>
      </div>
    </div>
  );
}
