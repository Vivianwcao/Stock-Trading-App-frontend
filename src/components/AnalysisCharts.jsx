import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { fmtCAD } from "../utils/format";

// 20-color palette with good contrast for multi-series charts
const PALETTE = [
  "#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f",
  "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#86bcb6",
  "#d37295", "#fabfd2", "#8cd17d", "#499894", "#f1ce63",
  "#a0cbe8", "#ffbe7d", "#aecbd6", "#f9a9a9", "#b6992d",
];

function buildColorMap(symbols) {
  const map = {};
  symbols.forEach((sym, i) => {
    map[sym] = PALETTE[i % PALETTE.length];
  });
  return map;
}

// Shared tooltip formatter for currency values
const fmtCurrencyLabel = (value) =>
  value != null ? fmtCAD(value) : "—";

// Shared tooltip formatter for % values
const fmtPctLabel = (value) =>
  value != null ? `${value.toFixed(2)}%` : "—";

// ── Chart 1: Growth % over time ──────────────────────────────────────────────
function GrowthChart({ data, symbols, colorMap, t }) {
  const chartData = [...new Set(data.map((r) => r.last_successful_sync))]
    .sort()
    .map((syncDate) => {
      const entry = { date: syncDate.slice(0, 10) };
      symbols.forEach((sym) => {
        const row = data.find(
          (r) => r.symbol === sym && r.last_successful_sync === syncDate,
        );
        entry[sym] = row?.growth_percentage ?? null;
      });
      return entry;
    });

  return (
    <div className="chart-section">
      <h3 className="chart-title">{t.chartGrowth ?? "Growth %"}</h3>
      <div className="chart-scroll-x">
        <ResponsiveContainer width={Math.max(600, chartData.length * 60)} height={320}>
          <LineChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11 }}
              width={52}
            />
            <Tooltip formatter={fmtPctLabel} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            {symbols.map((sym) => (
              <Line
                key={sym}
                type="monotone"
                dataKey={sym}
                stroke={colorMap[sym]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Chart 2: Cost % allocation over time (stacked bar) ───────────────────────
function AllocationChart({ data, symbols, colorMap, t }) {
  const chartData = [...new Set(data.map((r) => r.last_successful_sync))]
    .sort()
    .map((syncDate) => {
      const entry = { date: syncDate.slice(0, 10) };
      symbols.forEach((sym) => {
        const row = data.find(
          (r) => r.symbol === sym && r.last_successful_sync === syncDate,
        );
        entry[sym] = row?.bought_ratio ?? 0;
      });
      return entry;
    });

  // Bar height scales with symbol count so individual bars are readable
  const barHeight = Math.max(280, symbols.length * 14);

  return (
    <div className="chart-section">
      <h3 className="chart-title">{t.chartAllocation ?? "Cost % Allocation"}</h3>
      <div className="chart-scroll-x">
        <ResponsiveContainer width={Math.max(600, chartData.length * 60)} height={barHeight + 80}>
          <BarChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11 }}
              width={52}
              domain={[0, 100]}
            />
            <Tooltip formatter={fmtPctLabel} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            {symbols.map((sym) => (
              <Bar key={sym} dataKey={sym} stackId="cost" fill={colorMap[sym]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Chart 3: Portfolio value over time (total_bought vs total_current) ────────
function PortfolioValueChart({ data, t }) {
  const chartData = [...new Set(data.map((r) => r.last_successful_sync))]
    .sort()
    .map((syncDate) => {
      // total_bought / total_current are the same for all symbols at a given snapshot
      const row = data.find((r) => r.last_successful_sync === syncDate);
      return {
        date: syncDate.slice(0, 10),
        [t.totalBought ?? "Total Cost"]: row?.total_bought ?? null,
        [t.totalCurrent ?? "Total Current"]: row?.total_current ?? null,
      };
    });

  const boughtKey = t.totalBought ?? "Total Cost";
  const currentKey = t.totalCurrent ?? "Total Current";

  return (
    <div className="chart-section">
      <h3 className="chart-title">{t.chartPortfolio ?? "Portfolio Value"}</h3>
      <div className="chart-scroll-x">
        <ResponsiveContainer width={Math.max(600, chartData.length * 60)} height={320}>
          <LineChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tickFormatter={(v) => fmtCAD(v)}
              tick={{ fontSize: 11 }}
              width={80}
            />
            <Tooltip formatter={fmtCurrencyLabel} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Line
              type="monotone"
              dataKey={boughtKey}
              stroke="#e15759"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey={currentKey}
              stroke="#59a14f"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
// data: flat rows from compare_analysis_by_account_across_snapshots
export default function AnalysisCharts({ t, data }) {
  if (!data || data.length === 0) {
    return <div className="status-msg">{t.noPositions}</div>;
  }

  const symbols = [...new Set(data.map((r) => r.symbol))].sort();
  const colorMap = buildColorMap(symbols);

  return (
    <div className="analysis-charts">
      <GrowthChart data={data} symbols={symbols} colorMap={colorMap} t={t} />
      <AllocationChart data={data} symbols={symbols} colorMap={colorMap} t={t} />
      <PortfolioValueChart data={data} t={t} />
    </div>
  );
}
