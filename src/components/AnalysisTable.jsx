import { fmtPrice, fmtUnits, fmtCAD, fmtPct } from "../utils/format";

// rows: filtered to the active account's nickname, from the analysis view
// rankCol: one of the *_rnk column names or "cost_basis" — rank 1 = top position
export default function AnalysisTable({ t, rows, rankCol }) {
  if (!rows.length) {
    return <div className="status-msg">{t.noPositions}</div>;
  }

  // rank columns are 1-based integers; cost_basis is a raw decimal — both sort ascending
  const sorted = [...rows].sort(
    (a, b) => (a[rankCol] ?? 9999) - (b[rankCol] ?? 9999),
  );

  return (
    <div className="table-wrapper">
      <table className="tx-table analysis-table">
        <thead>
          <tr>
            <th>{t.symbol}</th>
            <th className="num">{t.holdings}</th>
            <th className="num">{t.costBasis}</th>
            <th className="num">{t.currentPrice}</th>
            <th className="num">{t.growthPct}</th>
            <th className="num">{t.boughtBalance}</th>
            <th className="num">{t.boughtRatio}</th>
            <th className="num">{t.currentBalance}</th>
            <th className="num">{t.currentRatio}</th>
            <th className="num">{t.dividendBalance}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i}>
              <td className="sym-col">
                <strong>{row.symbol}</strong>
              </td>
              <td className="num">{fmtUnits(row.holdings)}</td>
              <td className="num">{fmtPrice(row.cost_basis)}</td>
              <td className="num">{fmtPrice(row.current_price)}</td>
              <td
                className={`num rank-col ${
                  row.growth_percentage > 0 ? "pos"
                  : row.growth_percentage < 0 ? "neg"
                  : ""
                }`}>
                {fmtPct(row.growth_percentage)}
              </td>
              <td className="num rank-col rank-bought">
                {fmtCAD(row.bought_balance)}
              </td>
              <td className="num rank-col rank-pct">
                {row.bought_ratio != null ? `${row.bought_ratio}%` : "-"}
              </td>
              <td className="num rank-col rank-current">
                {fmtCAD(row.current_balance)}
              </td>
              <td className="num rank-col rank-pct">
                {row.current_ratio != null ? `${row.current_ratio}%` : "-"}
              </td>
              <td className="num">
                {row.dividend_balance != null ?
                  fmtCAD(row.dividend_balance)
                : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
