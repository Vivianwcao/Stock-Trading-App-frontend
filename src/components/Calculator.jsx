import { useState } from 'react';
import { fmtPrice, fmtUnits, fmtCAD, fmtPct } from '../utils/format';

// avg_bought_price in the DB is negative — use Math.abs() throughout
function getAbsAvgCost(lastRow) {
  if (!lastRow || lastRow.avg_bought_price == null) return null;
  return Math.abs(lastRow.avg_bought_price);
}

function computeBuy(avgCost, currentHoldings, price, units) {
  const newHoldings = currentHoldings + units;
  const currentInvested = avgCost * currentHoldings;
  const newInvested = currentInvested + price * units;
  const newAvgCost = newHoldings > 0 ? newInvested / newHoldings : 0;
  return {
    newHoldings,
    newAvgCost,
    projectedPL: null,
    projectedReturn: null,
    amount: -(price * units), // cash out, negative
  };
}

function computeSell(avgCost, currentHoldings, price, units) {
  const proceeds = price * units;
  const costBasis = avgCost * units;
  const projectedPL = proceeds - costBasis;
  const projectedReturn = costBasis > 0 ? (projectedPL / costBasis) * 100 : null;
  const newHoldings = currentHoldings - units;
  return {
    newHoldings,
    newAvgCost: avgCost, // avg cost unchanged by selling
    projectedPL,
    projectedReturn,
    amount: proceeds, // cash in, positive
  };
}

export default function Calculator({ t, symbol, lastRow, onAdd, onClear, hasHypotheticals }) {
  const [price, setPrice] = useState('');
  const [units, setUnits] = useState('');
  const [tradeType, setTradeType] = useState('BUY');
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState('');

  const avgCost = getAbsAvgCost(lastRow);
  const currentHoldings = lastRow?.rolling_units ?? 0;

  const handleCalculate = () => {
    setErr('');
    const p = parseFloat(price);
    const u = parseFloat(units);
    if (!p || p <= 0 || !u || u <= 0) {
      setErr('Enter valid price and units.');
      return;
    }
    if (tradeType === 'SELL' && u > currentHoldings) {
      setErr(`Cannot sell more than current holdings (${currentHoldings}).`);
      return;
    }
    if (avgCost == null) {
      setErr('No existing position data available.');
      return;
    }

    const result =
      tradeType === 'BUY'
        ? computeBuy(avgCost, currentHoldings, p, u)
        : computeSell(avgCost, currentHoldings, p, u);

    setPreview({
      type: tradeType,
      price: p,
      units: u,
      trade_date: new Date().toISOString().slice(0, 10),
      ...result,
    });
  };

  const handleAdd = () => {
    if (!preview) return;
    onAdd(preview);
    setPreview(null);
    setPrice('');
    setUnits('');
  };

  return (
    <div className="calculator">
      <div className="calc-header">
        <h3 className="calc-title">
          {t.calcTitle} — {symbol}
        </h3>
        {hasHypotheticals && (
          <button className="btn btn-ghost" onClick={onClear}>
            {t.clearAll}
          </button>
        )}
      </div>

      {/* Current position summary */}
      <div className="calc-context">
        <span>
          {t.currentHoldings}: <strong>{fmtUnits(currentHoldings)}</strong>
        </span>
        <span>
          {t.currentAvgCost}:{' '}
          <strong>{avgCost != null ? fmtPrice(avgCost) : '—'}</strong>
        </span>
      </div>

      {/* Input row */}
      <div className="calc-inputs">
        <div className="type-toggle">
          <button
            className={`toggle-btn buy ${tradeType === 'BUY' ? 'active' : ''}`}
            onClick={() => { setTradeType('BUY'); setPreview(null); }}
          >
            {t.buy}
          </button>
          <button
            className={`toggle-btn sell ${tradeType === 'SELL' ? 'active' : ''}`}
            onClick={() => { setTradeType('SELL'); setPreview(null); }}
          >
            {t.sell}
          </button>
        </div>
        <label className="calc-field">
          <span>{t.calcPrice}</span>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={price}
            onChange={(e) => { setPrice(e.target.value); setPreview(null); }}
            placeholder="0.0000"
          />
        </label>
        <label className="calc-field">
          <span>{t.calcUnits}</span>
          <input
            type="number"
            min="1"
            step="1"
            value={units}
            onChange={(e) => { setUnits(e.target.value); setPreview(null); }}
            placeholder="0"
          />
        </label>
        <button className="btn btn-primary" onClick={handleCalculate}>
          Calculate
        </button>
      </div>

      {err && <div className="calc-error">{err}</div>}

      {/* Preview result */}
      {preview && (
        <div className="calc-preview">
          <div className="preview-grid">
            <div className="preview-item">
              <span className="preview-label">{t.newHoldings}</span>
              <span className="preview-value">{fmtUnits(preview.newHoldings)}</span>
            </div>
            <div className="preview-item">
              <span className="preview-label">{t.newAvgCost}</span>
              <span className="preview-value">
                {preview.newAvgCost != null ? fmtPrice(preview.newAvgCost) : '—'}
              </span>
            </div>
            {preview.projectedPL != null && (
              <div className="preview-item">
                <span className="preview-label">{t.projectedPL}</span>
                <span className={`preview-value ${preview.projectedPL >= 0 ? 'pos' : 'neg'}`}>
                  {fmtCAD(preview.projectedPL)}
                </span>
              </div>
            )}
            {preview.projectedReturn != null && (
              <div className="preview-item">
                <span className="preview-label">{t.projectedReturn}</span>
                <span className={`preview-value ${preview.projectedReturn >= 0 ? 'pos' : 'neg'}`}>
                  {fmtPct(preview.projectedReturn)}
                </span>
              </div>
            )}
          </div>
          <button className="btn btn-secondary" onClick={handleAdd}>
            {t.addRow} ★
          </button>
        </div>
      )}
    </div>
  );
}
