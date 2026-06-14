/**
 * AnalyticsDashboard.jsx  —  SCAFIS Modern White Theme
 *
 * DESIGN: Matches reference image exactly
 *   ✅ White background with soft shadows
 *   ✅ Bold KPI numbers with up/down badges
 *   ✅ Smooth area chart with blue gradient fill
 *   ✅ Donut charts with inner labels
 *   ✅ Proper table layouts with alternating rows
 *   ✅ All charts use recharts with modern styling
 *   ✅ Long label support (truncate + tooltip)
 *   ✅ All API/logic identical to original
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import { analyticsApi } from "../services/analyticsApi";
import useAuthStore from "../store/authStore";
import {
  PBI, fmtChart, computeChartLayout, buildWaterfall,
  AdaptiveChartFrame, ChartTooltip, DynamicPolarTick, DynamicXTick, DynamicYCategoryTick, normalizeChartRows,
  legendStyle, yAxisProps, buildChartMargins, pbiGridProps,
} from "../components/charts/chartEngine";
import {
  DynamicClusteredBarChart, DynamicVarianceBarChart, DynamicWaterfallChart,
  DynamicComboChart, DynamicBarSeries,
} from "../components/charts/DynamicCharts";
import { PowerBIDonut } from "../components/charts/PowerBIDonut";

/* ═══ THEME — white/light like reference image ══════════════════════════════ */
const W = {
  bg:        "#f8fafc",
  card:      "#ffffff",
  border:    "#e2e8f0",
  borderLo:  "#f1f5f9",
  accent:    "#059669",    /* emerald — matches inventory */
  accentDk:  "#047857",
  accentGl:  "rgba(59,130,246,0.08)",
  green:     "#16a34a",
  greenBg:   "#f0fdf4",
  red:       "#dc2626",
  redBg:     "#fef2f2",
  amber:     "#d97706",
  amberBg:   "#fffbeb",
  purple:    "#7c3aed",
  cyan:      "#0891b2",
  teal:      "#0d9488",
  indigo:    "#4f46e5",
  textPri:   "#0f172a",
  textSec:   "#64748b",
  textDim:   "#94a3b8",
  gridLine:  "#e2e8f0",
};

const PALETTE = [
  "#118DFF", // Corporate Blue
  "#12239E", // Deep Sapphire
  "#10b981", // Teal
  "#E66C37", // Warm Amber
  "#6B007B", // Purple
  "#E044A7", // Pink/Magenta
  "#00b4d8", // Light Blue/Teal
  "#ef4444", // Red
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* ═══ GLOBAL STYLES ═══════════════════════════════════════════════════════════ */
if (typeof document !== "undefined" && !document.getElementById("ad-white-css")) {
  const s = document.createElement("style");
  s.id = "ad-white-css";
  s.textContent = `
    .aw-spin { animation: aw-s 0.9s linear infinite; }
    @keyframes aw-s { to { transform: rotate(360deg); } }
    .aw-fade { animation: aw-f 0.35s ease; }
    @keyframes aw-f { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
    .aw-tab {
      padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 600;
      cursor: pointer; border: 1.5px solid #e2e8f0; white-space: nowrap;
      transition: all .18s; background: #fff; color: #64748b;
    }
    .aw-tab:hover { background: #f8fafc; color: #0f172a; border-color: #cbd5e1; }
    .aw-tab.active { background: #059669; color: #fff; border-color: #059669; box-shadow: 0 4px 12px rgba(5,150,105,0.25); }
    .aw-tr:hover td { background: #f8fafc !important; }
    .aw-btn-primary { padding: 9px 22px; border-radius: 8px; border: none; background: #059669; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .18s; }
    .aw-btn-primary:hover { background: #047857; }
    .aw-btn-ghost { padding: 8px 16px; border-radius: 8px; border: 1.5px solid #e2e8f0; background: #fff; color: #64748b; font-size: 12px; font-weight: 600; cursor: pointer; transition: all .18s; }
    .aw-btn-ghost:hover { border-color: #059669; color: #059669; }
    .aw-inp { background: #fff; border: 1.5px solid #e2e8f0; border-radius: 8px; color: #0f172a; font-size: 13px; padding: 8px 12px; outline: none; transition: border-color .18s; }
    .aw-inp:focus { border-color: #059669; }
    .recharts-legend-item-text { font-size: 11px !important; font-weight: 600 !important; color: #64748b !important; }
    .aw-pulse { animation: aw-p 3s ease-in-out infinite; }
    @keyframes aw-p { 0%, 100% { opacity: 1; stroke-width: 2.5; } 50% { opacity: 0.8; stroke-width: 3.5; } }
    .pbi-card { background:#fff; border:1px solid #edebe9; border-radius:8px; box-shadow:0 1.6px 3.6px rgba(0,0,0,.06),0 0.3px 0.9px rgba(0,0,0,.04); }
    .pbi-chart-title { font-size:13px; font-weight:600; color:#252423; margin:0 0 2px; }
    .pbi-chart-sub { font-size:11px; color:#605e5c; margin:0 0 16px; }
    .pbi-databar { height:6px; border-radius:3px; background:#f3f2f1; overflow:hidden; margin-top:4px; }
    .pbi-databar-fill { height:100%; border-radius:3px; transition:width .4s ease; }
  `;
  document.head.appendChild(s);
}

/* ═══ HELPERS ════════════════════════════════════════════════════════════════ */
const fmt = fmtChart;

function Badge({ val }) {
  if (val > 0) return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:2, padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:700, background:W.greenBg, color:W.green }}>
      ↑ {val}%
    </span>
  );
  if (val < 0) return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:2, padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:700, background:W.redBg, color:W.red }}>
      ↓ {Math.abs(val)}%
    </span>
  );
  return <span style={{ padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:600, background:"#f1f5f9", color:W.textDim }}>—</span>;
}

/* ═══ CHART PRIMITIVES ════════════════════════════════════════════════════════ */
function WhiteTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return <ChartTooltip active={active} payload={payload} label={label} formatter={(v) => `PKR ${fmt(v)}`} />;
}

function PBIChartCard({ title, subtitle, children, height, style = {} }) {
  return (
    <div className="pbi-card" style={{ padding: "18px 20px", ...style }}>
      {title && <p className="pbi-chart-title">{title}</p>}
      {subtitle && <p className="pbi-chart-sub">{subtitle}</p>}
      <div style={{ width: "100%", height: height || "auto" }}>{children}</div>
    </div>
  );
}

function DataBar({ value, max, color = PBI.actual }) {
  const pct = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  return (
    <div className="pbi-databar">
      <div className="pbi-databar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/* ── Spinner ── */
function Spinner() {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"56px 0" }}>
      <div className="aw-spin" style={{ width:28, height:28, borderRadius:"50%", border:`2.5px solid ${W.border}`, borderTopColor:W.accent }} />
    </div>
  );
}

/* ── White Card ── */
function Card({ title, subtitle, children, actions, style={} }) {
  return (
    <div style={{
      background: W.card, border: `1px solid ${W.border}`,
      borderRadius: 16, padding: "20px 24px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      ...style,
    }}>
      {(title || actions) && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: subtitle ? 4 : 18 }}>
          <div>
            {title && <p style={{ fontSize:14, fontWeight:700, color:W.textPri, margin:0 }}>{title}</p>}
            {subtitle && <p style={{ fontSize:12, color:W.textDim, margin:"2px 0 0" }}>{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {subtitle && <div style={{ marginBottom:18 }} />}
      {children}
    </div>
  );
}

/* ── KPI Card — matches reference image cards ── */
function KpiCard({ icon, label, value, growth, vsLabel, color = W.accent, bgColor }) {
  const bg = bgColor || `${color}12`;
  return (
    <div style={{
      background: W.card, border: `1px solid ${W.border}`,
      borderRadius: 16, padding: "20px 22px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:12 }}>
        <p style={{ fontSize:13, fontWeight:600, color:W.textSec, margin:0 }}>{label}</p>
        {icon && (
          <div style={{ width:36, height:36, borderRadius:10, background:bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontSize:17, color }}>{icon}</span>
          </div>
        )}
      </div>
      <p style={{ fontFamily:"monospace", fontSize:26, fontWeight:800, color:W.textPri, margin:"0 0 8px", letterSpacing:"-0.02em" }}>
        {value}
      </p>
      {growth !== undefined && (
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <Badge val={growth} />
          {vsLabel && <span style={{ fontSize:11, color:W.textDim }}>{vsLabel}</span>}
        </div>
      )}
    </div>
  );
}

/* ── Table ── */
function DataTable({ headers, rows, emptyMsg = "No data available." }) {
  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
        <thead>
          <tr style={{ background: '#EBF2EE', borderBottom: '2px solid #D1E0D8' }}>
            {headers.map((h,i) => (
              <th key={i} style={{
                padding:"10px 14px", textAlign: h.right?"right":"left",
                fontWeight: 900, fontSize: 10, color: '#2E4D3F',
                letterSpacing: "0.1em", textTransform: "uppercase",
                whiteSpace:"nowrap",
              }}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!rows.length && (
            <tr>
              <td colSpan={headers.length} style={{ textAlign:"center", padding:"32px", color:W.textDim, fontSize:13 }}>
                {emptyMsg}
              </td>
            </tr>
          )}
          {rows.map((row, ri) => (
            <tr key={ri} className="aw-tr" style={{ borderBottom:`1px solid ${W.borderLo}` }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{
                  padding:"11px 14px",
                  textAlign: headers[ci]?.right ? "right" : "left",
                  ...cell?.style,
                }}>
                  {cell?.node ?? cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ═══ TABS ════════════════════════════════════════════════════════════════════ */
const TABS = [
  { id:"trends",      label:"📈 Trends"      },
  { id:"comparative", label:"📊 Comparative" },
  { id:"vertical",    label:"🔢 Vertical"    },
  { id:"sectors",     label:"🏭 Sectors"     },
  { id:"operations",  label:"📦 Operations"  },
  { id:"budget",      label:"🎯 Budget"      },
  { id:"variance",    label:"📉 Variance"    },
];

/* ═══════════════════════════════════════════════════════════════════════════
   TREND TAB
═══════════════════════════════════════════════════════════════════════════ */
function TrendTab({ companyId }) {
  const [data, setData]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [months, setMonths] = useState(12);

  useEffect(() => {
    let ig = false;
    Promise.resolve().then(() => { if (!ig) setLoading(true); });
    analyticsApi.getTrends(companyId, months)
      .then(r => { if (!ig) setData(r); })
      .catch(console.error)
      .finally(() => { if (!ig) setLoading(false); });
    return () => { ig = true; };
  }, [companyId, months]);

  const labels = useMemo(() => data.map((d) => d.label), [data]);
  const magnitudes = useMemo(() => data.flatMap((d) => [d.revenue, d.expenses, d.profit]), [data]);
  const trendLayout = useMemo(() => computeChartLayout(labels, { seriesCount: 3, valueMagnitudes: magnitudes, minHeight: 280 }), [labels, magnitudes]);
  const profitLayout = useMemo(() => computeChartLayout(labels, { valueMagnitudes: data.map((d) => d.profit), minHeight: 200 }), [labels, data]);

  if (loading && !data.length) return <Spinner />;
  const latest = data[data.length - 1] || {};

  return (
    <div className="aw-fade" style={{ display:"flex", flexDirection:"column", gap:18 }}>

      {/* KPI row — matches reference image */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:14 }}>
        <KpiCard icon="💰" label="Revenue"    value={`PKR ${fmt(latest.revenue)}`}  growth={latest.revenue_growth}  vsLabel="vs last period" color="#16a34a" />
        <KpiCard icon="📊" label="Expenses"   value={`PKR ${fmt(latest.expenses)}`} growth={latest.expense_growth}  vsLabel="vs last period" color="#dc2626" />
        <KpiCard icon="📈" label="Net Profit" value={`PKR ${fmt(latest.profit)}`}   growth={latest.profit_growth}   vsLabel="vs last period" color={W.accent} />
      </div>

      {/* Period toggle */}
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        <span style={{ fontSize:12, color:W.textSec, fontWeight:600 }}>Period:</span>
        {[3, 6, 12].map(m => (
          <button key={m} onClick={() => setMonths(m)}
            className={`aw-tab${months === m ? " active" : ""}`}
            style={{ padding:"6px 14px", fontSize:12 }}>
            {m} months
          </button>
        ))}
      </div>

      {/* Main area chart — like reference image */}
      <Card title="Revenue & Profit Trend"
        actions={<span style={{ fontSize:11, color:W.textDim }}>Last {months} months · {trendLayout.orientation} layout</span>}>
        <AdaptiveChartFrame layout={trendLayout}>
          <AreaChart data={data} margin={buildChartMargins(trendLayout)}>
            <defs>
              <linearGradient id="wgRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#118DFF" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#118DFF" stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="wgExp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.08} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={W.gridLine} vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" interval={trendLayout.tickInterval} height={trendLayout.bottomMargin}
              tick={(p) => <DynamicXTick {...p} layout={trendLayout} lookup={data.map(d => ({ name: d.label, fullName: d.label }))} />} axisLine={false} tickLine={false} />
            <YAxis {...yAxisProps(trendLayout)} />
            <Tooltip content={<WhiteTooltip />} cursor={{ stroke:W.border, strokeWidth:1 }} />
            <Legend iconType="circle" verticalAlign="top" align="right" wrapperStyle={{ paddingBottom:16, fontSize:11, fontWeight: "bold" }} />
            <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#118DFF" strokeWidth={3} fill="url(#wgRev)" dot={false} activeDot={{ r:6, fill:"#118DFF", stroke:"#fff", strokeWidth:2 }} />
            <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={2} fill="url(#wgExp)" strokeDasharray="5 5" dot={false} />
            <Line type="monotone" dataKey="profit" name="Net Profit" stroke="#10b981" strokeWidth={2.5} dot={false} />
          </AreaChart>
        </AdaptiveChartFrame>
      </Card>

      <Card title="Monthly Profit">
        <AdaptiveChartFrame layout={profitLayout}>
          <BarChart data={data} margin={buildChartMargins(profitLayout)}>
            <CartesianGrid stroke={W.gridLine} vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" interval={profitLayout.tickInterval} height={profitLayout.bottomMargin}
              tick={(p) => <DynamicXTick {...p} layout={profitLayout} lookup={data.map(d => ({ name: d.label, fullName: d.label }))} />} axisLine={false} tickLine={false} />
            <YAxis {...yAxisProps(profitLayout)} />
            <Tooltip content={<WhiteTooltip />} cursor={{ fill:"#f8fafc", radius: 4 }} />
            <Bar dataKey="profit" name="Profit" radius={[4,4,0,0]} maxBarSize={profitLayout.maxBarSize}>
              {data.map((d, i) => <Cell key={i} fill={d.profit >= 0 ? "#10b981" : "#ef4444"} style={{ outline: "none" }} />)}
            </Bar>
          </BarChart>
        </AdaptiveChartFrame>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPARATIVE TAB — Power BI style
═══════════════════════════════════════════════════════════════════════════ */
function ComparativeTab({ companyId }) {
  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const prevMonth = curMonth === 1 ? 12 : curMonth - 1;
  const prevYear = curMonth === 1 ? now.getFullYear() - 1 : now.getFullYear();
  const [p1, setP1] = useState({ month: prevMonth, year: prevYear });
  const [p2, setP2] = useState({ month: curMonth, year: now.getFullYear() });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    analyticsApi.getComparative(companyId, p1, p2)
      .then(setData).catch(console.error).finally(() => setLoading(false));
  }, [companyId, p1, p2]);

  useEffect(() => {
    let ig = false;
    Promise.resolve().then(() => { if (!ig) setLoading(true); });
    analyticsApi.getComparative(companyId, p1, p2)
      .then(r => { if (!ig) setData(r); }).catch(console.error)
      .finally(() => { if (!ig) setLoading(false); });
    return () => { ig = true; };
  }, [companyId, p1, p2]);

  const allRows = useMemo(() => {
    if (!data) return [];
    return Object.values(data).flat();
  }, [data]);

  const summary = useMemo(() => {
    const t1 = allRows.reduce((s, r) => s + Math.abs(r.period1?.net || 0), 0);
    const t2 = allRows.reduce((s, r) => s + Math.abs(r.period2?.net || 0), 0);
    const variance = t2 - t1;
    const pct = t1 !== 0 ? parseFloat(((variance / t1) * 100).toFixed(1)) : 0;
    return { t1, t2, variance, pct };
  }, [allRows]);

  const p1Label = data && allRows[0]?.period1?.label ? allRows[0].period1.label : `${MONTHS[p1.month - 1]} ${p1.year}`;
  const p2Label = data && allRows[0]?.period2?.label ? allRows[0].period2.label : `${MONTHS[p2.month - 1]} ${p2.year}`;

  const sel = (val, setter) => (
    <div style={{ display: "flex", gap: 8 }}>
      <select value={val.month} onChange={e => setter(v => ({ ...v, month: +e.target.value }))} className="aw-inp" style={{ flex: 1 }}>
        {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
      </select>
      <input type="number" value={val.year} onChange={e => setter(v => ({ ...v, year: +e.target.value }))}
        className="aw-inp" style={{ width: 84 }} />
    </div>
  );

  const renderTypeSection = (type, rows) => {
    if (!rows?.length) return null;

    const sorted = [...rows].sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
    const rawRows = sorted.map((r) => ({
      account_name: r.account_name,
      p1: Math.abs(r.period1?.net || 0),
      p2: Math.abs(r.period2?.net || 0),
      variance: r.variance,
      variance_pct: r.variance_pct,
    }));

    const categories = rawRows.map((r) => r.account_name);
    const magnitudes = rawRows.flatMap((r) => [r.p1, r.p2, r.variance]);
    const layout = computeChartLayout(categories, { seriesCount: 2, valueMagnitudes: magnitudes, minHeight: 280, maxHeight: 720, forceHorizontal: true });
    const chartRows = normalizeChartRows(rawRows, "account_name", layout);
    const waterfall = buildWaterfall(sorted.slice(0, layout.orientation === "horizontal" ? sorted.length : Math.min(12, sorted.length)));
    const wfLayout = computeChartLayout(waterfall.map((w) => w.fullName), { valueMagnitudes: waterfall.map((w) => w.variance), minHeight: 260, forceVertical: true });
    const maxVal = Math.max(...chartRows.flatMap((r) => [r.p1, r.p2]), 1);

    const series = [
      { dataKey: "p1", name: p1Label, fill: PBI.p1 },
      { dataKey: "p2", name: p2Label, fill: PBI.p2 },
    ];

    return (
      <div key={type} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
          <div style={{ width: 4, height: 22, borderRadius: 2, background: PBI.p2 }} />
          <h3 style={{ fontSize: 15, fontWeight: 700, color: W.textPri, margin: 0 }}>{type}</h3>
          <span style={{ fontSize: 11, color: W.textDim, fontWeight: 600 }}>{rows.length} accounts</span>
          <span style={{ fontSize: 10, color: W.textDim, background: "#f1f5f9", padding: "2px 8px", borderRadius: 4 }}>
            {layout.orientation === "horizontal" ? "Auto horizontal · all accounts" : `Vertical · ${chartRows.length} shown`}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <PBIChartCard title="Clustered Column Chart" subtitle={`${p1Label} vs ${p2Label}`} height={layout.chartHeight + 20}>
            <AdaptiveChartFrame layout={layout}>
              <DynamicClusteredBarChart chartRows={chartRows} layout={layout} lookup={chartRows} series={series} />
            </AdaptiveChartFrame>
          </PBIChartCard>

          <PBIChartCard title="Period Combo Analysis" subtitle="Bars + variance % trend" height={layout.chartHeight + 20}>
            <AdaptiveChartFrame layout={layout}>
              <DynamicComboChart
                chartRows={chartRows}
                layout={layout}
                lookup={chartRows}
                barSeries={series}
                lineKey="variance_pct"
                lineName="Variance %"
                lineFormatter={(v, name) => String(name).includes("%") ? `${v}%` : `PKR ${fmt(v)}`}
              />
            </AdaptiveChartFrame>
          </PBIChartCard>
        </div>

        {waterfall.length > 0 && (
          <PBIChartCard title="Variance Waterfall" subtitle="Period-over-period change bridge" height={wfLayout.chartHeight + 20}>
            <AdaptiveChartFrame layout={wfLayout}>
              <DynamicWaterfallChart waterfall={waterfall} layout={wfLayout} lookup={waterfall} />
            </AdaptiveChartFrame>
          </PBIChartCard>
        )}

        <div className="pbi-card" style={{ padding: "18px 20px" }}>
          <p className="pbi-chart-title">Detail Table</p>
          <p className="pbi-chart-sub">Full names on hover · conditional data bars</p>
          <DataTable
            headers={[
              { label: "Account" },
              { label: p1Label, right: true },
              { label: p2Label, right: true },
              { label: "Variance", right: true },
              { label: "%", right: true },
            ]}
            rows={rows.map((r) => {
              const p2v = Math.abs(r.period2?.net || 0);
              return [
                {
                  node: (
                    <div title={r.account_name}>
                      <span style={{ fontWeight: 600, color: W.textPri, fontSize: 12, wordBreak: "break-word" }}>{r.account_name}</span>
                      <DataBar value={p2v} max={maxVal} color={PBI.p2} />
                    </div>
                  ),
                },
                { node: <span style={{ fontFamily: "monospace", color: W.textSec, fontSize: 12 }}>{fmt(r.period1?.net)}</span>, style: { textAlign: "right" } },
                { node: <span style={{ fontFamily: "monospace", fontSize: 12 }}>{fmt(r.period2?.net)}</span>, style: { textAlign: "right" } },
                { node: <span style={{ fontFamily: "monospace", fontWeight: 700, color: r.variance >= 0 ? PBI.positive : PBI.negative, fontSize: 12 }}>{fmt(r.variance)}</span>, style: { textAlign: "right" } },
                { node: <Badge val={r.variance_pct} />, style: { textAlign: "right" } },
              ];
            })}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="aw-fade" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="pbi-card" style={{ padding: "20px 22px" }}>
        <p className="pbi-chart-title">Period Comparison Slicer</p>
        <p className="pbi-chart-sub">Select two periods — visuals update automatically (Power BI slicer style)</p>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3.5 items-end">
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: W.textSec, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 }}>Period 1 (Baseline)</p>
            {sel(p1, setP1)}
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: W.textSec, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 }}>Period 2 (Comparison)</p>
            {sel(p2, setP2)}
          </div>
          <button onClick={load} className="aw-btn-primary" style={{ height: 40 }}>Refresh</button>
        </div>
      </div>

      {loading && <Spinner />}

      {!loading && data && allRows.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <KpiCard icon="📅" label={p1Label} value={`PKR ${fmt(summary.t1)}`} color={PBI.p1} />
            <KpiCard icon="📅" label={p2Label} value={`PKR ${fmt(summary.t2)}`} color={PBI.p2} />
            <KpiCard icon="Δ" label="Net Change" value={`PKR ${fmt(summary.variance)}`} growth={summary.pct} vsLabel="vs baseline" color={summary.variance >= 0 ? PBI.positive : PBI.negative} />
          </div>

          {Object.entries(data).map(([type, rows]) => renderTypeSection(type, rows))}
        </>
      )}

      {!loading && data && allRows.length === 0 && (
        <Card title="No comparative data"><p style={{ color: W.textSec, fontSize: 13 }}>No ledger activity found for the selected periods.</p></Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VERTICAL TAB
═══════════════════════════════════════════════════════════════════════════ */
function VerticalTab({ companyId }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    analyticsApi.getVertical(companyId, month, year)
      .then(setData).catch(console.error).finally(() => setLoading(false));
  }, [companyId, month, year]);

  useEffect(() => {
    let ig = false;
    Promise.resolve().then(() => { if (!ig) setLoading(true); });
    analyticsApi.getVertical(companyId, month, year).then(r => { if (!ig) setData(r); })
      .catch(console.error).finally(() => { if (!ig) setLoading(false); });
    return () => { ig = true; };
  }, [companyId, month, year]);

  const renderSection = (title, items, total) => {
    const categories = (items || []).map((i) => i.account_name);
    const layout = computeChartLayout(categories, { valueMagnitudes: (items || []).map((i) => i.amount), minHeight: 240, forceHorizontal: (items || []).length > 5 });
    const chartRows = normalizeChartRows(items || [], "account_name", layout);

    return (
    <Card title={title} subtitle={`Total: PKR ${fmt(total)}`}>
      {(items || []).length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <AdaptiveChartFrame layout={layout}>
            <BarChart layout={layout.orientation === "horizontal" ? "vertical" : "horizontal"} data={chartRows} margin={buildChartMargins(layout)}>
              <CartesianGrid {...pbiGridProps} />
              {layout.orientation === "horizontal" ? (
                <>
                  <XAxis type="number" tickFormatter={fmt} tick={{ fill: "#605e5c", fontSize: layout.tickFontSize }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={layout.yAxisWidth} tick={(p) => <DynamicYCategoryTick {...p} layout={layout} lookup={chartRows} />} axisLine={false} tickLine={false} />
                </>
              ) : (
                <>
                  <XAxis dataKey="name" interval={layout.tickInterval} height={layout.bottomMargin} tick={(p) => <DynamicXTick {...p} layout={layout} lookup={chartRows} />} axisLine={false} tickLine={false} />
                  <YAxis {...yAxisProps(layout)} />
                </>
              )}
              <Tooltip content={(p) => <ChartTooltip {...p} fullLabel={p.label} formatter={(v) => `PKR ${fmt(v)}`} />} />
              <Bar dataKey="amount" name="Amount" radius={layout.orientation === "horizontal" ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={layout.maxBarSize}>
                {chartRows.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </AdaptiveChartFrame>
        </div>
      )}
      {items.map((item, i) => (
        <div key={i} style={{ marginBottom:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
            <span style={{ fontSize:12, color:W.textPri, fontWeight:500, maxWidth:"65%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={item.account_name}>
              {item.account_name}
            </span>
            <span style={{ fontSize:12, color:W.textSec, fontFamily:"monospace" }}>
              {fmt(item.amount)} <span style={{ color:W.textDim }}>({item.percentage}%)</span>
            </span>
          </div>
          <div style={{ height:6, background:"#f1f5f9", borderRadius:4, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${Math.min(item.percentage, 100)}%`, background:PALETTE[i % PALETTE.length], borderRadius:4, transition:"width .5s ease" }} />
          </div>
        </div>
      ))}
    </Card>
    );
  };

  return (
    <div className="aw-fade" style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <div style={{ display:"flex", gap:10, alignItems:"flex-end", flexWrap:"wrap" }}>
        <div>
          <p style={{ fontSize:11, fontWeight:700, color:W.textSec, textTransform:"uppercase", letterSpacing:".1em", marginBottom:6 }}>Month</p>
          <select value={month} onChange={e => setMonth(+e.target.value)} className="aw-inp">
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
        </div>
        <div>
          <p style={{ fontSize:11, fontWeight:700, color:W.textSec, textTransform:"uppercase", letterSpacing:".1em", marginBottom:6 }}>Year</p>
          <input type="number" value={year} onChange={e => setYear(+e.target.value)} className="aw-inp" style={{ width:90 }} />
        </div>
        <button onClick={load} className="aw-btn-primary">Analyze</button>
      </div>
      {loading && <Spinner />}
      {!loading && data && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:16 }}>
          {renderSection("Income Statement (% of Revenue)", data.income_statement?.items || [], data.income_statement?.total_revenue)}
          {renderSection("Balance Sheet (% of Total Assets)", data.balance_sheet?.items || [], data.balance_sheet?.total_assets)}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTOR TAB
═══════════════════════════════════════════════════════════════════════════ */
function SectorTab({ companyId }) {
  const [data, setData]     = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let ig = false;
    Promise.resolve().then(() => { if (!ig) setLoading(true); });
    analyticsApi.getSectorGrowth(companyId, 6)
      .then(r => { if (!ig) setData(r); }).catch(console.error)
      .finally(() => { if (!ig) setLoading(false); });
    return () => { ig = true; };
  }, [companyId]);

  const barData = useMemo(() => data.map((s) => ({
    name: s.sector,
    fullName: s.sector,
    revenue: s.periods.reduce((a, p) => a + p.revenue, 0),
  })), [data]);
  const sectorLayout = useMemo(() => computeChartLayout(
    barData.map((d) => d.name),
    { valueMagnitudes: barData.map((d) => d.revenue), minHeight: 280, maxHeight: 560, forceHorizontal: true }
  ), [barData]);
  const sectorChartRows = useMemo(() => normalizeChartRows(barData, "name", sectorLayout), [barData, sectorLayout]);
  const total = barData.reduce((s, d) => s + d.revenue, 0);
  const donutColors = PALETTE.slice(0, barData.length);

  if (loading && !data.length) return <Spinner />;

  return (
    <div className="aw-fade" style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {!data.length && <Card title="Sector Revenue"><p style={{ color:W.textSec, fontSize:13 }}>No sector data. Add delivered sector transactions to see data here.</p></Card>}

      {/* Mini trend cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:12 }}>
        {data.map((sector, si) => (
          <Card key={sector.sector} style={{ padding:"16px 18px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <p style={{ fontSize:13, fontWeight:700, color:W.textPri, margin:0 }}>{sector.sector}</p>
              <Badge val={sector.overall_growth_pct} />
            </div>
            <ResponsiveContainer width="100%" height={50}>
              <LineChart data={sector.periods}>
                <Line type="monotone" dataKey="revenue" stroke={PALETTE[si % PALETTE.length]} strokeWidth={2.5} dot={false} />
                <Tooltip content={<WhiteTooltip />} />
              </LineChart>
            </ResponsiveContainer>
            <p style={{ fontSize:11, color:W.textDim, marginTop:6 }}>
              Latest: <span style={{ color:W.textPri, fontFamily:"monospace", fontWeight:700 }}>PKR {fmt(sector.periods[sector.periods.length-1]?.revenue)}</span>
            </p>
          </Card>
        ))}
      </div>

      {data.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:16, alignItems:"stretch" }}>
          <Card title="Sector Revenue Comparison" style={{ flex:"2 1 480px" }}>
            <AdaptiveChartFrame layout={sectorLayout}>
              <DynamicBarSeries
                chartRows={sectorChartRows}
                layout={sectorLayout}
                lookup={sectorChartRows}
                dataKey="revenue"
                name="Revenue"
                fill="#118DFF"
              />
            </AdaptiveChartFrame>
          </Card>

          {/* Donut — matches reference image "Traffic Sources" */}
          <Card title="Revenue Distribution" style={{ flex:"1 1 300px" }}>
            <PowerBIDonut
              data={barData.map(d => ({ name: d.name, value: d.revenue }))}
              colors={donutColors}
              height={220}
              centerLabel="Total Revenue"
              centerValue={`PKR ${fmt(total)}`}
            />
          </Card>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   OPERATIONS TAB
═══════════════════════════════════════════════════════════════════════════ */
function OperationsTab({ companyId }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let ig = false;
    Promise.resolve().then(() => { if (!ig) setLoading(true); });
    analyticsApi.getOperationalInsights(companyId)
      .then(r => { if (!ig) setData(r); }).catch(console.error)
      .finally(() => { if (!ig) setLoading(false); });
    return () => { ig = true; };
  }, [companyId]);

  if (loading && !data) return <Spinner />;

  const summary    = data?.summary || {};
  const products   = data?.top_products || [];
  const warehouses = data?.warehouse_load || [];
  const sectors    = data?.sector_profitability || [];

  return (
    <div className="aw-fade" style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12 }}>
        {[
          { icon:"📦", label:"SKU Count",        value: String(summary.total_skus||0),        color:"#4f46e5" },
          { icon:"⚠️", label:"Low Stock SKUs",   value: String(summary.low_stock_skus||0),    color:W.red   },
          { icon:"💰", label:"Inventory Value",   value:`PKR ${fmt(summary.inventory_value)}`, color:W.green },
          { icon:"🏭", label:"Warehouses",        value: String(summary.warehouse_count||0),   color:W.cyan  },
          { icon:"🚚", label:"Delivered Revenue", value:`PKR ${fmt(summary.delivered_revenue)}`,color:W.accent},
          { icon:"📋", label:"Delivered Orders",  value: String(summary.delivered_count||0),   color:W.amber },
        ].map(k => (
          <KpiCard key={k.label} icon={k.icon} label={k.label} value={k.value} color={k.color} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card title="Top Inventory Products">
            <DataTable
              headers={[
                { label:"Product" }, { label:"SKU" },
                { label:"Qty", right:true }, { label:"Value", right:true },
              ]}
              emptyMsg="No product inventory data."
              rows={products.map(p => [
                { node: <span style={{ fontWeight:600, color:W.textPri }}>{p.product_name}</span> },
                { node: <span style={{ fontFamily:"monospace", fontSize:11, color:W.textDim }}>{p.sku}</span> },
                { node: <span style={{ fontFamily:"monospace" }}>{fmt(p.qty)}</span>, style:{textAlign:"right"} },
                { node: <span style={{ fontFamily:"monospace", fontWeight:700, color:W.green }}>PKR {fmt(p.stock_value)}</span>, style:{textAlign:"right"} },
              ])}
            />
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card title="Warehouse Load">
            {!warehouses.length
              ? <p style={{ color:W.textDim, fontSize:13 }}>No warehouse data.</p>
              : (
                <PowerBIDonut
                  data={warehouses.map((w) => ({ name: w.warehouse_name, value: w.estimated_value || 0 }))}
                  colors={PALETTE}
                  height={240}
                  centerLabel="Load Value"
                  centerValue={`PKR ${fmt(warehouses.reduce((a, c) => a + (c.estimated_value || 0), 0))}`}
                />
              )
            }
          </Card>
        </div>
      </div>

      <Card title="Sector Profitability">
        <DataTable
          headers={[
            { label:"Sector" }, { label:"Deliveries", right:true },
            { label:"Revenue", right:true }, { label:"Gross Profit", right:true },
            { label:"Margin", right:true },
          ]}
          emptyMsg="No sector profitability data."
          rows={sectors.map(s => [
            { node: <span style={{ fontWeight:600, color:W.textPri }}>{s.sector_name}</span> },
            { node: <span style={{ fontFamily:"monospace" }}>{s.delivery_count}</span>, style:{textAlign:"right"} },
            { node: <span style={{ fontFamily:"monospace" }}>PKR {fmt(s.total_revenue)}</span>, style:{textAlign:"right"} },
            { node: <span style={{ fontFamily:"monospace", fontWeight:700, color:s.gross_profit>=0?W.green:W.red }}>PKR {fmt(s.gross_profit)}</span>, style:{textAlign:"right"} },
            { node: <Badge val={s.margin_pct} />, style:{textAlign:"right"} },
          ])}
        />
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   BUDGET TAB
═══════════════════════════════════════════════════════════════════════════ */
function BudgetTab({ companyId }) {
  const now = new Date();
  const [year,setYear]   = useState(now.getFullYear());
  const [month,setMonth] = useState(now.getMonth()+1);
  const [budgets,setBudgets] = useState([]);
  const [loading,setLoading] = useState(false);
  const [form,setForm] = useState({ budget_type:"account",account_id:"",sector_id:"",period_month:now.getMonth()+1,period_year:now.getFullYear(),budget_amount:"",notes:"" });
  const [saving,setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    analyticsApi.getBudgets(companyId,year,month).then(setBudgets).catch(console.error).finally(() => setLoading(false));
  }, [companyId,year,month]);

  useEffect(() => {
    let ig=false; Promise.resolve().then(()=>{if(!ig)setLoading(true);});
    analyticsApi.getBudgets(companyId,year,month).then(r=>{if(!ig)setBudgets(r)}).catch(console.error).finally(()=>{if(!ig)setLoading(false);});
    return()=>{ig=true};
  }, [companyId,year,month]);

  const save = async () => {
    if (!form.budget_amount) return;
    setSaving(true);
    try { await analyticsApi.createBudget(companyId,form); load(); setForm(f=>({...f,budget_amount:"",notes:""})); }
    catch(e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const remove = async id => {
    if (!confirm("Delete this budget?")) return;
    await analyticsApi.deleteBudget(companyId,id); load();
  };

  const F = ({ label, children }) => (
    <div>
      <p style={{ fontSize:11, fontWeight:700, color:W.textSec, textTransform:"uppercase", letterSpacing:".1em", marginBottom:6 }}>{label}</p>
      {children}
    </div>
  );

  return (
    <div className="aw-fade" style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <Card title="Add / Update Budget">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, marginBottom:16 }}>
          <F label="Type">
            <select value={form.budget_type} onChange={e=>setForm(f=>({...f,budget_type:e.target.value}))} className="aw-inp" style={{ width:"100%" }}>
              <option value="account">Account</option>
              <option value="sector">Sector</option>
            </select>
          </F>
          {form.budget_type==="account"
            ? <F label="Account ID"><input value={form.account_id} onChange={e=>setForm(f=>({...f,account_id:e.target.value}))} placeholder="e.g. 42" className="aw-inp" style={{ width:"100%" }} /></F>
            : <F label="Sector"><input value={form.sector_id} onChange={e=>setForm(f=>({...f,sector_id:e.target.value}))} placeholder="e.g. Textile" className="aw-inp" style={{ width:"100%" }} /></F>
          }
          <F label="Month">
            <select value={form.period_month} onChange={e=>setForm(f=>({...f,period_month:+e.target.value}))} className="aw-inp" style={{ width:"100%" }}>
              {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
            </select>
          </F>
          <F label="Year"><input type="number" value={form.period_year} onChange={e=>setForm(f=>({...f,period_year:+e.target.value}))} className="aw-inp" style={{ width:"100%" }} /></F>
          <F label="Budget Amount (PKR)"><input type="number" value={form.budget_amount} onChange={e=>setForm(f=>({...f,budget_amount:e.target.value}))} placeholder="0" className="aw-inp" style={{ width:"100%" }} /></F>
          <F label="Notes"><input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Optional" className="aw-inp" style={{ width:"100%" }} /></F>
        </div>
        <button onClick={save} disabled={saving} className="aw-btn-primary" style={{ opacity:saving?0.6:1 }}>
          {saving ? "Saving…" : "Save Budget"}
        </button>
      </Card>

      <div style={{ display:"flex", gap:10, alignItems:"flex-end", flexWrap:"wrap" }}>
        <div>
          <p style={{ fontSize:11, fontWeight:700, color:W.textSec, textTransform:"uppercase", letterSpacing:".1em", marginBottom:6 }}>Filter Month</p>
          <select value={month} onChange={e=>setMonth(+e.target.value)} className="aw-inp">
            {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
          </select>
        </div>
        <div>
          <p style={{ fontSize:11, fontWeight:700, color:W.textSec, textTransform:"uppercase", letterSpacing:".1em", marginBottom:6 }}>Year</p>
          <input type="number" value={year} onChange={e=>setYear(+e.target.value)} className="aw-inp" style={{ width:90 }} />
        </div>
        <button onClick={load} className="aw-btn-ghost">Filter</button>
      </div>

      {loading && <Spinner />}
      {!loading && (
        <Card title={`Budgets — ${MONTHS[month-1]} ${year}`}>
          <DataTable
            headers={[
              { label:"Account / Sector" }, { label:"Type" },
              { label:"Budget", right:true }, { label:"Period", right:true },
              { label:"Action", right:true },
            ]}
            emptyMsg="No budgets for this period."
            rows={budgets.map(b => [
              { node: <span style={{ fontWeight:600, color:W.textPri }}>{b.account_name||(b.account_id?`Account #${b.account_id}`:b.sector_id)||"—"}</span> },
              { node: <span style={{ fontSize:12, color:W.textSec, background:"#f1f5f9", padding:"2px 8px", borderRadius:6 }}>{b.budget_type}</span> },
              { node: <span style={{ fontFamily:"monospace", fontWeight:700, color:W.accent }}>PKR {fmt(b.budget_amount)}</span>, style:{textAlign:"right"} },
              { node: <span style={{ color:W.textSec }}>{MONTHS[b.period_month-1]} {b.period_year}</span>, style:{textAlign:"right"} },
              { node: <button onClick={()=>remove(b.id)} style={{ background:"none", border:"none", color:W.red, fontSize:12, fontWeight:700, cursor:"pointer" }}>Delete</button>, style:{textAlign:"right"} },
            ])}
          />
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VARIANCE TAB — Power BI style
═══════════════════════════════════════════════════════════════════════════ */
function VarianceTab({ companyId }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    analyticsApi.getBudgetVsActual(companyId, year, month).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [companyId, year, month]);

  useEffect(() => {
    let ig = false;
    Promise.resolve().then(() => { if (!ig) setLoading(true); });
    analyticsApi.getBudgetVsActual(companyId, year, month).then(r => { if (!ig) setData(r); }).catch(console.error).finally(() => { if (!ig) setLoading(false); });
    return () => { ig = true; };
  }, [companyId, year, month]);

  const items = useMemo(() => data?.items || [], [data?.items]);
  const summary = data?.summary || {};
  const utilization = summary.total_budget > 0
    ? Math.min(100, (summary.total_actual / summary.total_budget) * 100)
    : 0;

  const rawVarianceRows = useMemo(() =>
    [...items]
      .map((r) => ({
        account_name: r.account_name || r.sector_id || "Account",
        budget: Math.abs(r.budget_amount || 0),
        actual: Math.abs(r.actual_amount || 0),
        variance: r.variance,
        variance_pct: r.variance_pct,
        status: r.status,
      }))
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance)),
  [items]);

  const varianceLayout = useMemo(() => computeChartLayout(
    rawVarianceRows.map((r) => r.account_name),
    { seriesCount: 2, valueMagnitudes: rawVarianceRows.flatMap((r) => [r.budget, r.actual, r.variance]), minHeight: 300, maxHeight: 720, forceHorizontal: true }
  ), [rawVarianceRows]);

  const chartItems = useMemo(() => normalizeChartRows(rawVarianceRows, "account_name", varianceLayout), [rawVarianceRows, varianceLayout]);

  const waterfall = useMemo(() => buildWaterfall(
    rawVarianceRows.slice(0, varianceLayout.orientation === "horizontal" ? rawVarianceRows.length : Math.min(15, rawVarianceRows.length))
  ), [rawVarianceRows, varianceLayout]);

  const wfLayout = useMemo(() => computeChartLayout(
    waterfall.map((w) => w.fullName),
    { valueMagnitudes: waterfall.map((w) => w.variance), minHeight: 260 }
  ), [waterfall]);

  const radarItems = useMemo(() => rawVarianceRows.slice(0, Math.min(12, rawVarianceRows.length)), [rawVarianceRows]);

  const maxBudget = Math.max(...rawVarianceRows.map((i) => Math.max(i.budget, i.actual)), 1);

  return (
    <div className="aw-fade" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="pbi-card" style={{ padding: "20px 22px" }}>
        <p className="pbi-chart-title">Variance Analysis Slicer</p>
        <p className="pbi-chart-sub">{MONTHS[month - 1]} {year} — Budget vs Actual performance</p>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: W.textSec, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 }}>Month</p>
            <select value={month} onChange={e => setMonth(+e.target.value)} className="aw-inp">
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: W.textSec, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 }}>Year</p>
            <input type="number" value={year} onChange={e => setYear(+e.target.value)} className="aw-inp" style={{ width: 90 }} />
          </div>
          <button onClick={load} className="aw-btn-primary">Refresh</button>
        </div>
      </div>

      {loading && <Spinner />}

      {!loading && data && (
        <>
          {/* KPI cards with utilization gauge */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <KpiCard icon="🎯" label="Total Budget" value={`PKR ${fmt(summary.total_budget)}`} color={PBI.budget} />
            <KpiCard icon="📊" label="Total Actual" value={`PKR ${fmt(summary.total_actual)}`} color={PBI.actual} />
            <KpiCard icon="📉" label="Total Variance" value={`PKR ${fmt(summary.total_variance)}`}
              growth={summary.total_variance_pct}
              color={summary.total_variance >= 0 ? PBI.positive : PBI.negative} />
            <div className="pbi-card" style={{ padding: "20px 22px" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: W.textSec, margin: "0 0 12px" }}>Budget Utilization</p>
              <div style={{ position: "relative", height: 8, background: "#f3f2f1", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${utilization}%`, borderRadius: 4,
                  background: utilization > 100 ? PBI.negative : utilization > 85 ? "#E66C37" : PBI.positive,
                  transition: "width 0.6s ease",
                }} />
              </div>
              <p style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 800, color: W.textPri, margin: "10px 0 0" }}>
                {utilization.toFixed(1)}%
              </p>
              <p style={{ fontSize: 11, color: W.textDim }}>Actual ÷ Budget</p>
            </div>
          </div>

          {items.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              <PBIChartCard title="Budget vs Actual" subtitle={`Clustered · ${varianceLayout.orientation} · ${chartItems.length} accounts`} height={varianceLayout.chartHeight + 20} style={{ gridColumn: chartItems.length > 6 ? "1 / -1" : undefined }}>
                <AdaptiveChartFrame layout={varianceLayout}>
                  <DynamicClusteredBarChart
                    chartRows={chartItems}
                    layout={varianceLayout}
                    lookup={chartItems}
                    series={[
                      { dataKey: "budget", name: "Budget", fill: PBI.budget },
                      { dataKey: "actual", name: "Actual", fill: PBI.actual },
                    ]}
                  />
                </AdaptiveChartFrame>
              </PBIChartCard>

              <PBIChartCard title="Variance by Account" subtitle="Favorable vs unfavorable" height={varianceLayout.chartHeight + 20}>
                <AdaptiveChartFrame layout={varianceLayout}>
                  <DynamicVarianceBarChart chartRows={chartItems} layout={varianceLayout} lookup={chartItems} />
                </AdaptiveChartFrame>
              </PBIChartCard>
            </div>
          )}

          {waterfall.length > 0 && (
            <PBIChartCard title="Variance Waterfall Bridge" subtitle="Cumulative budget variance decomposition" height={wfLayout.chartHeight + 20}>
              <AdaptiveChartFrame layout={wfLayout}>
                <DynamicWaterfallChart waterfall={waterfall} layout={wfLayout} lookup={waterfall} />
              </AdaptiveChartFrame>
            </PBIChartCard>
          )}

          {items.length > 0 && (
            <>
              <PBIChartCard title="Multi-Axis Performance Radar" subtitle="Budget envelope vs actual spend" height={Math.max(360, radarItems.length * 28)}>
                <AdaptiveChartFrame layout={{ chartHeight: Math.max(360, radarItems.length * 28) }}>
                  <RadarChart cx="50%" cy="50%" outerRadius={radarItems.length > 8 ? "68%" : "75%"} data={radarItems}>
                    <PolarGrid stroke="#edebe9" />
                    <PolarAngleAxis dataKey="account_name" tick={(p) => <DynamicPolarTick {...p} maxChars={radarItems.length > 8 ? 9 : 12} />} />
                    <PolarRadiusAxis angle={30} tick={{ fill: "#a19f9d", fontSize: 8 }} axisLine={false} tickLine={false} tickFormatter={fmt} />
                    <Radar name="Budget" dataKey="budget" stroke={PBI.budget} strokeWidth={2} fill={PBI.budget} fillOpacity={0.25} />
                    <Radar name="Actual" dataKey="actual" stroke={PBI.actual} strokeWidth={2.5} fill={PBI.actual} fillOpacity={0.2} />
                    <Tooltip content={(p) => <ChartTooltip {...p} fullLabel={p.label} />} />
                    <Legend iconType="circle" wrapperStyle={legendStyle} />
                  </RadarChart>
                </AdaptiveChartFrame>
              </PBIChartCard>

              <PBIChartCard title="Budget · Actual · Variance %" subtitle="Power BI combo visual" height={varianceLayout.chartHeight + 20}>
                <AdaptiveChartFrame layout={varianceLayout}>
                  <DynamicComboChart
                    chartRows={chartItems}
                    layout={varianceLayout}
                    lookup={chartItems}
                    barSeries={[
                      { dataKey: "budget", name: "Budget", fill: PBI.budget },
                      { dataKey: "actual", name: "Actual", fill: PBI.actual },
                    ]}
                    lineKey="variance_pct"
                    lineName="Var %"
                    lineFormatter={(v, name) => String(name).includes("%") ? `${v}%` : `PKR ${fmt(v)}`}
                  />
                </AdaptiveChartFrame>
              </PBIChartCard>
            </>
          )}

          <div className="pbi-card" style={{ padding: "18px 20px" }}>
            <p className="pbi-chart-title">Variance Detail Matrix</p>
            <p className="pbi-chart-sub">Table with conditional variance bars</p>
            <DataTable
              headers={[
                { label: "Account" },
                { label: "Budget", right: true },
                { label: "Actual", right: true },
                { label: "Variance", right: true },
                { label: "%", right: true },
                { label: "Status", right: true },
              ]}
              rows={items.map(row => [
                {
                  node: (
                    <div>
                      <span style={{ fontWeight: 600, color: W.textPri, fontSize: 12 }}>{row.account_name || row.sector_id}</span>
                      <DataBar value={row.actual_amount} max={maxBudget} color={row.status === "favorable" ? PBI.positive : PBI.negative} />
                    </div>
                  ),
                },
                { node: <span style={{ fontFamily: "monospace", color: W.textSec, fontSize: 12 }}>{fmt(row.budget_amount)}</span>, style: { textAlign: "right" } },
                { node: <span style={{ fontFamily: "monospace", fontSize: 12 }}>{fmt(row.actual_amount)}</span>, style: { textAlign: "right" } },
                { node: <span style={{ fontFamily: "monospace", fontWeight: 700, color: row.variance >= 0 ? PBI.positive : PBI.negative, fontSize: 12 }}>{fmt(row.variance)}</span>, style: { textAlign: "right" } },
                { node: <Badge val={row.variance_pct} />, style: { textAlign: "right" } },
                {
                  node: (
                    <span style={{
                      padding: "3px 10px", borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                      background: row.status === "favorable" ? "#dff6dd" : "#fde7e9",
                      color: row.status === "favorable" ? PBI.positive : PBI.negative,
                    }}>
                      {row.status}
                    </span>
                  ),
                  style: { textAlign: "right" },
                },
              ])}
            />
          </div>
        </>
      )}

      {!loading && data && !items.length && (
        <Card title="No variance data">
          <p style={{ color: W.textSec, fontSize: 13 }}>Create budgets in the Budget tab to see variance analysis here.</p>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ROOT
═══════════════════════════════════════════════════════════════════════════ */
export default function AnalyticsDashboard({ companyId }) {
  const [activeTab, setActiveTab] = useState("trends");
  const { activeCompany } = useAuthStore();
  const cid = companyId || activeCompany?.id || localStorage.getItem("activeCompanyId") || "1";

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(to bottom right, #F4FBF7, #FAF9F8, #F3FAF6)",
      padding: "20px 28px 72px",
      fontFamily: "var(--font-sans, -apple-system, BlinkMacSystemFont, sans-serif)",
    }}>
      {/* Top Banner Toolbar */}
      <div className="w-full bg-[#EBFDF5] border border-[#C2F3DC] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between shadow-sm mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#06b6d4] flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-extrabold text-[16px] md:text-[18px] text-[#064E3B] tracking-tight uppercase m-0">Financial Intelligence</h1>
              <span className="text-[10px] font-extrabold uppercase bg-emerald-500/15 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-500/20">Analytics</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 mt-0.5 mb-0">
              Overview of your financial performance & operations
            </p>
          </div>
        </div>
      </div>

      {/* Analytics Navigation Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 hide-scrollbar w-full">
        {TABS.map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 px-4 py-2.5 text-[13px] font-extrabold rounded-xl border transition-all cursor-pointer ${
              activeTab === tab.id 
                ? 'bg-gradient-to-r from-[#10b981] to-[#06b6d4] text-white border-transparent shadow-md shadow-emerald-500/20' 
                : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {activeTab === "trends"      && <TrendTab      companyId={cid} />}
        {activeTab === "comparative" && <ComparativeTab companyId={cid} />}
        {activeTab === "vertical"    && <VerticalTab    companyId={cid} />}
        {activeTab === "sectors"     && <SectorTab      companyId={cid} />}
        {activeTab === "operations"  && <OperationsTab  companyId={cid} />}
        {activeTab === "budget"      && <BudgetTab      companyId={cid} />}
        {activeTab === "variance"    && <VarianceTab     companyId={cid} />}
      </div>
    </div>
  );
}