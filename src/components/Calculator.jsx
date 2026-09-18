import { useState } from "react";
import {
  fmtPrice,
  fmtUnits,
  fmtCAD,
  fmtPct,
  fmtVancouver,
} from "../utils/format";

// avg_cost is always positive in the DB (SQL uses abs())
function getAvgCost(lastRow) {
  if (!lastRow || lastRow.avg_cost == null) return null;
  return lastRow.avg_cost;
}

// BUY: newAvgCost = (prevAvgCost * prevHoldings + price * units) / newHoldings
// bought_balance decreases (more negative) by the purchase amount
function computeBuy(avgCost, currentHoldings, boughtBalance, price, units) {
  const newHoldings = currentHoldings + units;
  const newInvested = avgCost * currentHoldings + price * units;
  const newAvgCost = newHoldings > 0 ? newInvested / newHoldings : 0;
  const amount = -(price * units); // negative: money out
  return {
    newHoldings,
    newAvgCost,
    projectedPL: null,
    projectedReturn: null,
    amount,
    newBoughtBalance: boughtBalance + amount,
  };
}

// SELL: avgCost stays the same; bought_balance reduces by cost basis of sold units
// DB formula: bought_balance - avg_bought_price * units (units is negative in DB, so this adds back)
// Here units is the positive user input, so: boughtBalance + avgCost * units
function computeSell(avgCost, currentHoldings, boughtBalance, price, units) {
  const proceeds = price * units;
  const costBasis = avgCost * units;
  const projectedPL = proceeds - costBasis;
  const projectedReturn =
    costBasis > 0 ? (projectedPL / costBasis) * 100 : null;
  return {
    newHoldings: currentHoldings - units,
    newAvgCost: avgCost,
    projectedPL,
    projectedReturn,
    amount: proceeds, // positive: money in
    newBoughtBalance: boughtBalance + avgCost * units,
  };
}

export default function Calculator({
  t,
  symbol,
  lastRow,
  ordersLastFetched,
  onCalculate,
  onClear,
  hasHypothetical,
  onRefreshOrders,
  refreshing,
  renderOrderStatus,
}) {
  const [price, setPrice] = useState("");
  const [units, setUnits] = useState("");
  const [tradeType, setTradeType] = useState("BUY");
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState("");

  const avgCost = getAvgCost(lastRow);
  const currentHoldings = lastRow?.holdings_per_cycle ?? 0;
  const boughtBalance = lastRow?.cost ?? 0;

  const handleCalculate = () => {
    setErr("");
    const p = parseFloat(price);
    const u = parseFloat(units);
    if (!p || p <= 0 || !u || u <= 0) {
      setErr("Enter valid price and units.");
      return;
    }
    if (tradeType === "SELL" && u > currentHoldings) {
      setErr(`Cannot sell more than current holdings (${currentHoldings}).`);
      return;
    }
    if (avgCost == null) {
      setErr("No existing position data available.");
      return;
    }
    const result =
      tradeType === "BUY" ?
        computeBuy(avgCost, currentHoldings, boughtBalance, p, u)
      : computeSell(avgCost, currentHoldings, boughtBalance, p, u);

    const row = {
      type: tradeType,
      price: p,
      units: tradeType === "SELL" ? -u : u,
      trade_date: new Date().toISOString().slice(0, 10),
      ...result,
    };
    setPreview(row);
    onCalculate(row);
  };

  const handleClear = () => {
    setPreview(null);
    setPrice("");
    setUnits("");
    setErr("");
    onClear();
  };

  return (
    <div className="calculator">
      {/* Title row */}
      <div className="calc-title-row">
        <span className="calc-title">{t.calcTitle}</span>
        <span className="calc-symbol">{symbol}</span>
      </div>

      {/* Action buttons + order status */}
      <div className="calc-actions">
        <button
          className="btn btn-orders"
          onClick={onRefreshOrders}
          disabled={refreshing}>
          {refreshing ? t.refreshing : t.refreshOrders}
        </button>
        {hasHypothetical && (
          <button className="btn btn-ghost" onClick={handleClear}>
            {t.clearAll}
          </button>
        )}
        {renderOrderStatus()}
      </div>
      {ordersLastFetched && (
        <div className="last-fetch-line">
          {t.lastOrders}: {fmtVancouver(ordersLastFetched)}
        </div>
      )}

      {/* Current position summary */}
      <div className="calc-context">
        <div className="calc-context-item">
          <span className="calc-context-label">{t.currentHoldings}</span>
          <strong>{fmtUnits(currentHoldings)}</strong>
        </div>
        <div className="calc-context-item">
          <span className="calc-context-label">{t.currentAvgCost}</span>
          <strong>{avgCost != null ? fmtPrice(avgCost) : "-"}</strong>
        </div>
      </div>

      {/* Inputs */}
      <div className="calc-inputs">
        <div className="type-toggle">
          <button
            className={`toggle-btn buy ${tradeType === "BUY" ? "active" : ""}`}
            onClick={() => {
              setTradeType("BUY");
              setPreview(null);
            }}>
            {t.buy}
          </button>
          <button
            className={`toggle-btn sell ${tradeType === "SELL" ? "active" : ""}`}
            onClick={() => {
              setTradeType("SELL");
              setPreview(null);
            }}>
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
            onChange={(e) => {
              setPrice(e.target.value);
              setPreview(null);
            }}
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
            onChange={(e) => {
              setUnits(e.target.value);
              setPreview(null);
            }}
            placeholder="0"
          />
        </label>
        <button
          className="btn btn-primary calc-btn-calculate"
          onClick={handleCalculate}>
          {t.calculate}
        </button>
      </div>

      {err && <div className="calc-error">{err}</div>}

      {/* Preview */}
      {preview && (
        <div className="calc-preview">
          <div className="preview-grid">
            <div className="preview-item">
              <span className="preview-label">{t.newHoldings}</span>
              <span className="preview-value">
                {fmtUnits(preview.newHoldings)}
              </span>
            </div>
            <div className="preview-item">
              <span className="preview-label">{t.newAvgCost}</span>
              <span className="preview-value">
                {preview.newAvgCost != null ?
                  fmtPrice(preview.newAvgCost)
                : "-"}
              </span>
            </div>
            {preview.projectedPL != null && (
              <div className="preview-item">
                <span className="preview-label">{t.projectedPL}</span>
                <span
                  className={`preview-value ${preview.projectedPL >= 0 ? "pos" : "neg"}`}>
                  {fmtCAD(preview.projectedPL)}
                </span>
              </div>
            )}
            {preview.projectedReturn != null && (
              <div className="preview-item">
                <span className="preview-label">{t.projectedReturn}</span>
                <span
                  className={`preview-value ${preview.projectedReturn >= 0 ? "pos" : "neg"}`}>
                  {fmtPct(preview.projectedReturn)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
