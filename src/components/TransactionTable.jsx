import { fmtDate, fmtPrice, fmtUnits, fmtCAD, fmtPct } from "../utils/format";

const TYPE_CLASS = {
  BUY: "type-buy",
  SELL: "type-sell",
  DIVIDEND: "type-div",
  SUBSTITUTE_DIVIDEND: "type-div",
  REI: "type-div",
  STOCK_DIVIDEND: "type-div",
  INTEREST: "type-other",
  FEE: "type-other",
  TAX: "type-other",
  TRANSFER: "type-other",
  CONTRIBUTION: "type-other",
  WITHDRAWAL: "type-other",
};

function cycleClass(cycles) {
  return cycles != null && cycles % 2 !== 0 ? "cycle-alt" : "";
}

// Today's date in Vancouver timezone (YYYY-MM-DD), computed once per render
function getToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
  }).format(new Date());
}

function RealRow({ row, today }) {
  const rowType = (row.type || "").toLowerCase();
  const isToday = row.trade_date?.slice(0, 10) === today;
  return (
    <tr
      className={`row-${rowType} ${cycleClass(row.cycles)}${isToday ? " row-today" : ""}`}>
      <td className="col-type">
        <span className={`type-badge ${TYPE_CLASS[row.type] || "type-other"}`}>
          {row.type}
        </span>
      </td>
      <td className="col-date">{fmtDate(row.trade_date)}</td>
      <td className="num">{fmtPrice(row.price)}</td>
      <td className="num">{fmtUnits(row.units)}</td>
      <td className={`num ${row.amount < 0 ? "neg" : "pos"}`}>
        {fmtCAD(row.amount)}
      </td>
      <td className="num">{fmtUnits(row.holdings_per_cycle)}</td>
      <td className="num col-em">{fmtPrice(row.avg_bought_price)}</td>
      <td className="num">
        {row.dividend_balance != null ? fmtCAD(row.dividend_balance) : "-"}
      </td>
      <td
        className={`num ${
          row.bought_balance < 0 ? "neg"
          : row.bought_balance > 0 ? "pos"
          : ""
        }`}>
        {row.bought_balance != null ? fmtCAD(row.bought_balance) : "-"}
      </td>
      <td
        className={`num col-em ${
          row.realized_profit > 0 ? "pos"
          : row.realized_profit < 0 ? "neg"
          : ""
        }`}>
        {row.realized_profit != null ? fmtCAD(row.realized_profit) : "-"}
      </td>
      <td
        className={`num col-em ${
          row.return_percentage > 0 ? "pos"
          : row.return_percentage < 0 ? "neg"
          : ""
        }`}>
        {fmtPct(row.return_percentage)}
      </td>
    </tr>
  );
}

function HypRow({ row }) {
  return (
    <tr className="row-hypothetical">
      <td className="col-type">
        <span className={`type-badge ${TYPE_CLASS[row.type]}`}>{row.type}</span>
      </td>
      <td className="col-date">
        {fmtDate(row.trade_date)}
        <span className="hyp-label"> ★</span>
      </td>
      <td className="num">{fmtPrice(row.price)}</td>
      <td className="num">{fmtUnits(row.units)}</td>
      <td className={`num ${row.amount < 0 ? "neg" : "pos"}`}>
        {fmtCAD(row.amount)}
      </td>
      <td className="num">{fmtUnits(row.newHoldings)}</td>
      <td className="num col-em">
        {row.newAvgCost != null ? fmtPrice(row.newAvgCost) : "-"}
      </td>
      <td className="num">-</td>
      <td
        className={`num ${
          row.newBoughtBalance < 0 ? "neg"
          : row.newBoughtBalance > 0 ? "pos"
          : ""
        }`}>
        {row.newBoughtBalance != null ? fmtCAD(row.newBoughtBalance) : "-"}
      </td>
      <td
        className={`num col-em ${
          row.projectedPL > 0 ? "pos"
          : row.projectedPL < 0 ? "neg"
          : ""
        }`}>
        {row.projectedPL != null ? fmtCAD(row.projectedPL) : "-"}
      </td>
      <td
        className={`num col-em ${
          row.projectedReturn > 0 ? "pos"
          : row.projectedReturn < 0 ? "neg"
          : ""
        }`}>
        {row.projectedReturn != null ? fmtPct(row.projectedReturn) : "-"}
      </td>
    </tr>
  );
}

export default function TransactionTable({ t, rows, hypothetical = null }) {
  if (!rows.length) return <div className="status-msg">{t.noData}</div>;

  const today = getToday();

  return (
    <div className="table-wrapper">
      <table className="tx-table">
        <thead>
          <tr>
            <th className="col-type">{t.type}</th>
            <th className="col-date">{t.date}</th>
            <th className="num">{t.price}</th>
            <th className="num">{t.units}</th>
            <th className="num">{t.amount}</th>
            <th className="num">{t.holdings}</th>
            <th className="num">{t.avgCost}</th>
            <th className="num">{t.dividends}</th>
            <th className="num">{t.boughtBalance}</th>
            <th className="num">{t.realizedPL}</th>
            <th className="num">{t.returnPct}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <RealRow key={i} row={row} today={today} />
          ))}
          {hypothetical && <HypRow row={hypothetical} />}
        </tbody>
      </table>
    </div>
  );
}
