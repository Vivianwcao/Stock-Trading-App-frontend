import { useState } from 'react';
import { api } from '../api';
import TransactionTable from './TransactionTable';
import Calculator from './Calculator';

export default function StockPanel({ t, nickname, accountId, symbols }) {
  const symbolList = Object.keys(symbols).sort();
  const [activeSym, setActiveSym] = useState(() => symbolList[0] || null);
  const [orderStatus, setOrderStatus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  // Hypothetical rows per symbol, persisted in sessionStorage
  const [hypotheticals, setHypotheticals] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(`hyp_${nickname}`) || '{}');
    } catch {
      return {};
    }
  });

  const saveHypotheticals = (next) => {
    setHypotheticals(next);
    try {
      sessionStorage.setItem(`hyp_${nickname}`, JSON.stringify(next));
    } catch {}
  };

  const addHypothetical = (sym, row) => {
    const next = { ...hypotheticals, [sym]: [...(hypotheticals[sym] || []), row] };
    saveHypotheticals(next);
  };

  const clearHypotheticals = (sym) => {
    const next = { ...hypotheticals, [sym]: [] };
    saveHypotheticals(next);
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

  const renderOrderStatus = () => {
    if (refreshing) return <span className="sync-msg syncing">{t.refreshing}</span>;
    if (!orderStatus) return null;
    if (orderStatus.status === 'success')
      return <span className="sync-msg ok">{t.ordersSuccess}</span>;
    if (orderStatus.status === 'cooldown') {
      const { seconds: s = 0 } = orderStatus.data || {};
      return <span className="sync-msg cooldown">{t.ordersCooldown(s)}</span>;
    }
    if (orderStatus.status === 'fail')
      return <span className="sync-msg fail">{orderStatus.error}</span>;
    return null;
  };

  if (!symbolList.length) return <div className="status-msg">{t.noSymbols}</div>;

  // When switching accounts the active symbol may not exist in the new account
  const currentSym = symbolList.includes(activeSym) ? activeSym : symbolList[0];
  const rows = symbols[currentSym] || [];
  const lastRow = rows[rows.length - 1]; // most recent real row

  return (
    <div className="stock-panel">
      {/* Toolbar: symbol tabs + refresh orders button */}
      <div className="stock-toolbar">
        <div className="stock-tabs">
          {symbolList.map((sym) => {
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
          })}
        </div>
        <div className="orders-area">
          <button
            className="btn btn-secondary"
            onClick={refreshOrders}
            disabled={refreshing}
          >
            {refreshing ? t.refreshing : t.refreshOrders}
          </button>
          {renderOrderStatus()}
        </div>
      </div>

      {/* Transaction table */}
      <TransactionTable
        t={t}
        rows={rows}
        hypotheticals={hypotheticals[currentSym] || []}
      />

      {/* Hypothetical calculator */}
      <Calculator
        t={t}
        symbol={currentSym}
        lastRow={lastRow}
        onAdd={(row) => addHypothetical(currentSym, row)}
        onClear={() => clearHypotheticals(currentSym)}
        hasHypotheticals={(hypotheticals[currentSym] || []).length > 0}
      />
    </div>
  );
}
