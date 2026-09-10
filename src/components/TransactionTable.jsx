import { fmtDate, fmtPrice, fmtUnits, fmtCAD, fmtPct } from '../utils/format';

const TYPE_CLASS = {
  BUY: 'type-buy',
  SELL: 'type-sell',
  DIVIDEND: 'type-div',
  SUBSTITUTE_DIVIDEND: 'type-div',
  REI: 'type-div',
  STOCK_DIVIDEND: 'type-div',
  INTEREST: 'type-other',
  FEE: 'type-other',
  TAX: 'type-other',
  TRANSFER: 'type-other',
  CONTRIBUTION: 'type-other',
  WITHDRAWAL: 'type-other',
};

function RealRow({ row }) {
  return (
    <tr className={`row-${(row.type || '').toLowerCase()}`}>
      <td className="col-date">{fmtDate(row.trade_date)}</td>
      <td>
        <span className={`type-badge ${TYPE_CLASS[row.type] || 'type-other'}`}>
          {row.type}
        </span>
      </td>
      <td className="num">{fmtPrice(row.price)}</td>
      <td className="num">{fmtUnits(row.units)}</td>
      <td className={`num ${row.amount < 0 ? 'neg' : 'pos'}`}>
        {fmtCAD(row.amount)}
      </td>
      <td className="num">{fmtUnits(row.rolling_units)}</td>
      <td className="num">{fmtPrice(row.avg_bought_price)}</td>
      <td className="num">
        {row.dividend_balance != null ? fmtCAD(row.dividend_balance) : '—'}
      </td>
      <td className={`num ${row.realized_profit > 0 ? 'pos' : row.realized_profit < 0 ? 'neg' : ''}`}>
        {row.realized_profit != null ? fmtCAD(row.realized_profit) : '—'}
      </td>
      <td className={`num ${row.return_percentage > 0 ? 'pos' : row.return_percentage < 0 ? 'neg' : ''}`}>
        {fmtPct(row.return_percentage)}
      </td>
    </tr>
  );
}

function HypRow({ row }) {
  return (
    <tr className="row-hypothetical">
      <td className="col-date">
        {fmtDate(row.trade_date)}
        <span className="hyp-label"> ★</span>
      </td>
      <td>
        <span className={`type-badge ${TYPE_CLASS[row.type]}`}>{row.type}</span>
      </td>
      <td className="num">{fmtPrice(row.price)}</td>
      <td className="num">{fmtUnits(row.units)}</td>
      <td className={`num ${row.amount < 0 ? 'neg' : 'pos'}`}>
        {fmtCAD(row.amount)}
      </td>
      <td className="num">{fmtUnits(row.newHoldings)}</td>
      <td className="num">{row.newAvgCost != null ? fmtPrice(row.newAvgCost) : '—'}</td>
      <td className="num">—</td>
      <td className={`num ${row.projectedPL > 0 ? 'pos' : row.projectedPL < 0 ? 'neg' : ''}`}>
        {row.projectedPL != null ? fmtCAD(row.projectedPL) : '—'}
      </td>
      <td className={`num ${row.projectedReturn > 0 ? 'pos' : row.projectedReturn < 0 ? 'neg' : ''}`}>
        {row.projectedReturn != null ? fmtPct(row.projectedReturn) : '—'}
      </td>
    </tr>
  );
}

export default function TransactionTable({ t, rows, hypotheticals = [] }) {
  if (!rows.length) return <div className="status-msg">{t.noData}</div>;

  return (
    <div className="table-wrapper">
      <table className="tx-table">
        <thead>
          <tr>
            <th className="col-date">{t.date}</th>
            <th>{t.type}</th>
            <th className="num">{t.price}</th>
            <th className="num">{t.units}</th>
            <th className="num">{t.amount}</th>
            <th className="num">{t.holdings}</th>
            <th className="num">{t.avgCost}</th>
            <th className="num">{t.dividends}</th>
            <th className="num">{t.realizedPL}</th>
            <th className="num">{t.returnPct}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <RealRow key={i} row={row} />
          ))}
          {hypotheticals.map((row, i) => (
            <HypRow key={`hyp-${i}`} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
