import { Fragment } from "react";
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
  LabelList,
} from "recharts";
import { fmtCAD } from "../utils/format";

// 20-color palette — all readable on light backgrounds
const PALETTE = [
  "#4e79a7",
  "#e15759",
  "#59a14f",
  "#f28e2b",
  "#b07aa1",
  "#76b7b2",
  "#9c755f",
  "#d37295",
  "#499894",
  "#e8a838",
  "#2e86c1",
  "#c0392b",
  "#27ae60",
  "#8e44ad",
  "#16a085",
  "#d35400",
  "#1f618d",
  "#7d3c98",
  "#1e8449",
  "#6e2f1a",
];

function buildColorMap(symbols) {
  const map = {};
  symbols.forEach((sym, i) => {
    map[sym] = PALETTE[i % PALETTE.length];
  });
  return map;
}

// Darken a hex color by multiplying RGB channels (amount < 1 = darker)
function darkenHex(hex, amount = 0.72) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * amount)}, ${Math.round(g * amount)}, ${Math.round(b * amount)})`;
}

function sortByAvg(symbols, data, col) {
  return [...symbols].sort((a, b) => {
    const avg = (sym) => {
      const rows = data.filter((r) => r.symbol === sym);
      if (!rows.length) return -Infinity;
      return rows.reduce((s, r) => s + (r[col] ?? 0), 0) / rows.length;
    };
    return avg(b) - avg(a);
  });
}

const fmtPct = (v) => (v != null ? `${v.toFixed(2)}%` : "—");
const fmtCur = (v) => (v != null ? fmtCAD(v) : "—");
const fmtShort = (v) => {
  if (v == null) return "";
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
};

// Chart height: fill the viewport minus the account tabs / sub-tabs overhead.
// Adjust the offset (currently 90) if charts feel too tall or too short on your screen.
function getChartH() {
  return Math.max(
    350,
    (typeof window !== "undefined" ? window.innerHeight : 800) - 90,
  );
}

// ── Shared tooltip styles ─────────────────────────────────────────────────────
const TT = {
  box: {
    background: "#fff",
    border: "1px solid #ccc",
    borderRadius: 4,
    padding: "5px 8px",
    fontSize: 12,
    lineHeight: 1.6,
    maxWidth: 280,
  },
  header: { fontWeight: 700, color: "#333", marginBottom: 2 },
  row: { display: "flex", alignItems: "center", gap: 5 },
  dot: {
    width: 7,
    height: 7,
    display: "inline-block",
    borderRadius: 2,
    flexShrink: 0,
  },
};

// ── Chart 1 tooltip: Growth % — sorted highest first ─────────────────────────
function GrowthTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload]
    .filter((p) => p.value != null)
    .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
  return (
    <div style={TT.box}>
      <div style={TT.header}>{label}</div>
      {sorted.map((item) => (
        <div key={item.dataKey} style={TT.row}>
          <span style={{ ...TT.dot, background: item.color }} />
          <span style={{ color: "#555" }}>{item.name}</span>
          <span style={{ marginLeft: "auto", paddingLeft: 8, fontWeight: 600 }}>
            {fmtPct(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Chart 2 tooltip: Allocation — one row per symbol, sorted by cost% desc ───
function AllocationTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const costItems = payload.filter((p) => p.dataKey?.endsWith("_c"));
  const currMap = {};
  payload
    .filter((p) => p.dataKey?.endsWith("_v"))
    .forEach((p) => {
      currMap[p.dataKey.slice(0, -2)] = p.value;
    });
  const sorted = [...costItems].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  return (
    <div style={TT.box}>
      <div style={TT.header}>{label}</div>
      {sorted.map((item) => {
        const sym = item.dataKey.slice(0, -2);
        const curr = currMap[sym];
        return (
          <div key={sym} style={TT.row}>
            <span style={{ ...TT.dot, background: item.fill }} />
            <span style={{ color: "#333", fontWeight: 600, minWidth: 38 }}>
              {sym}
            </span>
            <span style={{ color: "#555" }}>
              cost: {item.value != null ? `${item.value}%` : "—"} / current:{" "}
              {curr != null ? `${curr}%` : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Chart 3 tooltip: bar mode (single snapshot) ──────────────────────────────
function ValueBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TT.box}>
      <div style={TT.header}>{label}</div>
      {payload.map((item) => (
        <div key={item.dataKey} style={TT.row}>
          <span style={{ ...TT.dot, background: item.fill }} />
          <span style={{ color: "#555" }}>{item.name}</span>
          <span style={{ marginLeft: "auto", paddingLeft: 8, fontWeight: 600 }}>
            {fmtCur(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Chart 3 tooltip: line mode (multi snapshot) ──────────────────────────────
function ValueLineTooltip({ active, payload, label, colorMap }) {
  if (!active || !payload?.length) return null;
  const vItems = payload.filter(
    (p) => p.dataKey?.endsWith("_v") && p.value != null,
  );
  const cMap = {};
  payload
    .filter((p) => p.dataKey?.endsWith("_c"))
    .forEach((p) => {
      cMap[p.dataKey.slice(0, -2)] = p.value;
    });
  const sorted = [...vItems].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  return (
    <div style={TT.box}>
      <div style={TT.header}>{label}</div>
      {sorted.map((item) => {
        const sym = item.dataKey.slice(0, -2);
        return (
          <div key={sym} style={TT.row}>
            <span style={{ ...TT.dot, background: colorMap[sym] }} />
            <span style={{ color: "#333", fontWeight: 600, minWidth: 38 }}>
              {sym}
            </span>
            <span style={{ color: "#555" }}>
              {fmtCur(item.value)} / cost: {fmtCur(cMap[sym])}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Chart 1: Growth % over time ───────────────────────────────────────────────
function GrowthChart({ data, t }) {
  const rawSymbols = [...new Set(data.map((r) => r.symbol))];
  const symbols = sortByAvg(rawSymbols, data, "growth_percentage");
  const colorMap = buildColorMap(symbols);

  const dates = [...new Set(data.map((r) => r.last_successful_sync))].sort();
  const chartData = dates.map((syncDate) => {
    const entry = { date: syncDate.slice(0, 10) };
    symbols.forEach((sym) => {
      const row = data.find(
        (r) => r.symbol === sym && r.last_successful_sync === syncDate,
      );
      entry[sym] = row?.growth_percentage ?? null;
    });
    return entry;
  });

  const chartH = Math.max(600, symbols.length * 75 + 100);
  // Min width: 80px per date keeps labels readable; fills container if fewer dates
  const minW = Math.max(400, chartData.length * 80);
  // Darkened colors for lines — more visible against the light grid background
  const darkColorMap = Object.fromEntries(
    symbols.map((sym) => [sym, darkenHex(colorMap[sym])]),
  );

  return (
    <div id="chart-growth" className="chart-section">
      <h3 className="chart-title">{t.chartGrowth ?? "Growth %"}</h3>
      <div
        className="chart-scroll-x"
        style={{ maxHeight: "calc(100vh - 120px)", overflowY: "auto" }}>
        <div style={{ minWidth: minW, height: chartH }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{
                top: 8,
                right: 60,
                left: chartData.length <= 2 ? 50 : 8,
                bottom: 40,
              }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fontWeight: 700 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fontWeight: 700 }}
                width={48}
                tickCount={6}
                domain={[
                  (dataMin) => Math.floor((dataMin - 5) / 5) * 5,
                  (dataMax) => Math.ceil((dataMax + 5) / 5) * 5,
                ]}
              />
              <Tooltip isAnimationActive={false} content={<GrowthTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 10, paddingTop: 2, fontWeight: 700 }}
              />
              {symbols.map((sym) => (
                <Line
                  key={sym}
                  type="monotone"
                  dataKey={sym}
                  stroke={darkColorMap[sym]}
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, index } = props;
                    const showDot =
                      chartData.length <= 2 &&
                      (index === 0 || index === chartData.length - 1);
                    if (!showDot) return <circle key={index} r={0} />;
                    return (
                      <circle
                        key={index}
                        cx={cx}
                        cy={cy}
                        r={3}
                        fill={darkColorMap[sym]}
                        strokeWidth={0}
                      />
                    );
                  }}
                  connectNulls
                  name={sym}>
                  <LabelList
                    dataKey={sym}
                    content={({ x, y, index, value }) => {
                      if (value == null) return null;
                      const isLast = index === chartData.length - 1;
                      const isFirst = index === 0 && chartData.length <= 2;
                      if (!isLast && !isFirst) return null;
                      return (
                        <text
                          x={isFirst ? x - 6 : x + 6}
                          y={y}
                          fontSize={9}
                          fill={darkColorMap[sym]}
                          dominantBaseline="middle"
                          fontWeight={700}
                          textAnchor={isFirst ? "end" : "start"}>
                          {`${sym}: ${fmtPct(value)}`}
                        </text>
                      );
                    }}
                  />
                </Line>
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── Chart 2: Cost vs Current % Allocation — two stacked bars per date ─────────
function AllocationChart({ data, t }) {
  const rawSymbols = [...new Set(data.map((r) => r.symbol))];
  const symbols = sortByAvg(rawSymbols, data, "bought_ratio");
  const colorMap = buildColorMap(symbols);

  const dates = [...new Set(data.map((r) => r.last_successful_sync))].sort();
  const chartData = dates.map((syncDate) => {
    const entry = { date: syncDate.slice(0, 10) };
    symbols.forEach((sym) => {
      const row = data.find(
        (r) => r.symbol === sym && r.last_successful_sync === syncDate,
      );
      entry[`${sym}_c`] = row?.bought_ratio ?? null;
      entry[`${sym}_v`] = row?.current_ratio ?? null;
    });
    return entry;
  });

  // Ensure each bar segment is tall enough for the symbol label even on smaller screens
  const chartH = Math.max(getChartH(), symbols.length * 22 + 80);
  // Dynamic bar width: 50px max, 20px min; stays at 50 up to ~12 dates, shrinks beyond
  const barSize = Math.max(
    20,
    Math.min(50, Math.floor(600 / Math.max(1, chartData.length))),
  );
  // Min width: 130px per date accommodates wider bars + gap + label
  const minW = Math.max(400, chartData.length * 130);

  return (
    <div id="chart-allocation" className="chart-section">
      <h3 className="chart-title">
        {t.chartAllocation ?? "Cost vs Current % Allocation"}
        <span className="chart-subtitle">
          {" "}
          {t.chartAllocationSubtitle ?? "— solid: Cost %, dim: Current %"}
        </span>
      </h3>
      <div className="chart-scroll-x">
        <div style={{ minWidth: minW, height: chartH }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              barSize={barSize}
              barGap={4}
              barCategoryGap="20%"
              margin={{ top: 8, right: 24, left: 8, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fontWeight: 700 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fontWeight: 700 }}
                width={48}
                domain={[0, 100]}
              />
              <Tooltip
                isAnimationActive={false}
                content={<AllocationTooltip />}
              />
              <Legend
                wrapperStyle={{ fontSize: 10, paddingTop: 2, fontWeight: 700 }}
              />
              {[...symbols].reverse().map((sym) => (
                <Fragment key={sym}>
                  <Bar
                    dataKey={`${sym}_c`}
                    stackId="cost"
                    fill={darkenHex(colorMap[sym])}
                    name={sym}>
                    <LabelList
                      dataKey={`${sym}_c`}
                      position="center"
                      content={({ x, y, width, height, value }) => {
                        if (!value || height < 14 || width < 14) return null;
                        return (
                          <text
                            x={x + width / 2}
                            y={y + height / 2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={8}
                            fill="#fff"
                            fontWeight={700}>
                            {sym}
                          </text>
                        );
                      }}
                    />
                  </Bar>
                  <Bar
                    dataKey={`${sym}_v`}
                    stackId="curr"
                    fill={colorMap[sym]}
                    fillOpacity={0.45}
                    legendType="none"
                    name={`${sym}●`}>
                    <LabelList
                      dataKey={`${sym}_v`}
                      position="center"
                      content={({ x, y, width, height, value }) => {
                        if (!value || height < 14 || width < 14) return null;
                        return (
                          <text
                            x={x + width / 2}
                            y={y + height / 2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={8}
                            fill="#111"
                            fontWeight={700}>
                            {sym}
                          </text>
                        );
                      }}
                    />
                  </Bar>
                </Fragment>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── Chart 3: Position Cost vs Current Value ───────────────────────────────────
// Single date  → grouped bars per symbol (sorted by current_value desc)
// Multiple dates → line chart per symbol (solid=current_value, dashed=cost)
function ValueChart({ data, t }) {
  const dates = [...new Set(data.map((r) => r.last_successful_sync))].sort();
  const isMulti = dates.length > 1;
  const rawSymbols = [...new Set(data.map((r) => r.symbol))];
  const colorMap = buildColorMap(rawSymbols);

  const costLabel = t.positionCost ?? "Position Cost";
  const valueLabel = t.currentBalance ?? "Current Value";
  let chartH = getChartH();

  if (!isMulti) {
    // Single snapshot: grouped bars, X = symbol, sorted by current_value desc
    const latestRows = rawSymbols
      .map((sym) => {
        const rows = data
          .filter((r) => r.symbol === sym)
          .sort((a, b) =>
            b.last_successful_sync.localeCompare(a.last_successful_sync),
          );
        return rows[0];
      })
      .filter(Boolean)
      .sort((a, b) => (b.current_value ?? 0) - (a.current_value ?? 0));

    const chartData = latestRows.map((row) => ({
      symbol: row.symbol,
      [costLabel]: row.cost ?? 0,
      [valueLabel]: row.current_value ?? 0,
    }));

    // 56px per symbol (70% of prior 80px): tighter groups, less horizontal scroll
    const minW = Math.max(400, chartData.length * 56);

    return (
      <div id="chart-value" className="chart-section">
        <h3 className="chart-title">
          {t.chartSymbolValue ?? "Position Cost vs Current Value"}
        </h3>
        <div className="chart-scroll-x">
          <div style={{ minWidth: minW, height: chartH }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                barCategoryGap="22%"
                margin={{ top: 20, right: 24, left: 8, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis
                  dataKey="symbol"
                  tick={{ fontSize: 11, fontWeight: 700 }}
                />
                <YAxis
                  tickFormatter={(v) => fmtCAD(v)}
                  tick={{ fontSize: 11, fontWeight: 700 }}
                  width={76}
                />
                <Tooltip
                  isAnimationActive={false}
                  content={<ValueBarTooltip />}
                />
                <Legend
                  wrapperStyle={{
                    fontSize: 10,
                    paddingTop: 2,
                    fontWeight: 700,
                  }}
                />
                {/* barSize=14: narrow enough that 35% category gap clearly separates groups */}
                <Bar dataKey={costLabel} fill="#b8c8d2" barSize={14}>
                  <LabelList
                    dataKey={costLabel}
                    content={({ x, y, width, value }) => {
                      if (!value) return null;
                      return (
                        <text
                          x={x + width / 2}
                          y={y - 4}
                          textAnchor="middle"
                          fontSize={8}
                          fill="#555"
                          fontWeight={600}>
                          {fmtShort(value)}
                        </text>
                      );
                    }}
                  />
                </Bar>
                <Bar dataKey={valueLabel} fill="#4e7aaa" barSize={14}>
                  <LabelList
                    dataKey={valueLabel}
                    content={({ x, y, width, value }) => {
                      if (!value) return null;
                      return (
                        <text
                          x={x + width / 2}
                          y={y - 4}
                          textAnchor="middle"
                          fontSize={8}
                          fill="#555"
                          fontWeight={600}>
                          {fmtShort(value)}
                        </text>
                      );
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  }

  // Multi snapshot: line chart, X = dates
  const symbols = sortByAvg(rawSymbols, data, "current_value");
  const chartData = dates.map((syncDate) => {
    const entry = { date: syncDate.slice(0, 10) };
    symbols.forEach((sym) => {
      const row = data.find(
        (r) => r.symbol === sym && r.last_successful_sync === syncDate,
      );
      entry[`${sym}_v`] = row?.current_value ?? null;
      entry[`${sym}_c`] = row?.cost ?? null;
    });
    return entry;
  });

  const minW = Math.max(400, chartData.length * 80);
  chartH = Math.max(600, symbols.length * 75 + 100);

  return (
    <div id="chart-value" className="chart-section">
      <h3 className="chart-title">
        {t.chartSymbolValue ?? "Position Cost vs Current Value"}
        <span className="chart-subtitle">
          {" "}
          {t.chartValueSubtitle ?? "— solid: Current Value, dashed: Cost"}
        </span>
      </h3>
      <div
        className="chart-scroll-x"
        style={{ maxHeight: "calc(100vh - 120px)", overflowY: "auto" }}>
        <div style={{ minWidth: minW, height: chartH }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 60, left: 8, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
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
                width={76}
              />
              <Tooltip
                isAnimationActive={false}
                content={<ValueLineTooltip colorMap={colorMap} />}
              />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 2 }} />
              {symbols.map((sym) => (
                <Fragment key={sym}>
                  <Line
                    type="monotone"
                    dataKey={`${sym}_v`}
                    stroke={colorMap[sym]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    name={sym}>
                    <LabelList
                      dataKey={`${sym}_v`}
                      content={({ x, y, index, value }) => {
                        if (index !== chartData.length - 1 || value == null)
                          return null;
                        return (
                          <text
                            x={x + 6}
                            y={y}
                            fontSize={9}
                            fill={colorMap[sym]}
                            dominantBaseline="middle"
                            fontWeight={700}>
                            {sym}
                          </text>
                        );
                      }}
                    />
                  </Line>
                  <Line
                    type="monotone"
                    dataKey={`${sym}_c`}
                    stroke={colorMap[sym]}
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    dot={false}
                    connectNulls
                    legendType="none"
                    name={`${sym} cost`}>
                    <LabelList
                      dataKey={`${sym}_c`}
                      content={({ x, y, index, value }) => {
                        if (index !== chartData.length - 1 || value == null)
                          return null;
                        return (
                          <text
                            x={x + 6}
                            y={y + 12}
                            fontSize={9}
                            fill={colorMap[sym]}
                            dominantBaseline="middle"
                            fontWeight={400}
                            opacity={0.7}>
                            {sym}(c)
                          </text>
                        );
                      }}
                    />
                  </Line>
                </Fragment>
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function AnalysisCharts({ t, data }) {
  if (!data || data.length === 0) {
    return <div className="status-msg">{t.noPositions}</div>;
  }
  const isMulti = new Set(data.map((r) => r.last_successful_sync)).size > 1;
  return (
    <div className="analysis-charts">
      <GrowthChart data={data} t={t} />
      <AllocationChart data={data} t={t} />
      {!isMulti && <ValueChart data={data} t={t} />}
    </div>
  );
}
