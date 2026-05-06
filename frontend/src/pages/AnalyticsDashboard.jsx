/**
 * AnalyticsDashboard.jsx  —  SCAFIS Chart System Upgrade
 *
 * WHAT CHANGED (chart layer only — no logic/API changes):
 *  ✅ Dark theme: #1a1f2e / #12162a / #2a3044 / #6366f1
 *  ✅ Long label support: auto-rotation + custom tick with ellipsis + tooltip fallback
 *  ✅ Dynamic data: all axes auto-scale, no hardcoded limits
 *  ✅ Custom tooltips: glassmorphism dark style
 *  ✅ Area Chart: gradient fills with animated stroke
 *  ✅ Bar Chart: rounded tops, glow on hover
 *  ✅ Donut chart: inner label + legend with %, animated segments
 *  ✅ Radar Chart: dark polar grid with dual datasets
 *  ✅ KPI cards: dark glassmorphism with coloured glow
 *  ✅ All ResponsiveContainer uses are correct
 *  ✅ All API calls & state logic IDENTICAL to original
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie,
  AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar,
} from "recharts";
import { analyticsApi } from "../services/analyticsApi";
import useAuthStore from "../store/authStore";

/* ═══ THEME ══════════════════════════════════════════════════════════════════ */
const T = {
  bg:       "#1a1f2e",
  card:     "#12162a",
  cardDeep: "#0d1020",
  border:   "#2a3044",
  borderLo: "#1e2438",
  accent:   "#6366f1",
  accentLt: "#818cf8",
  accentGl: "rgba(99,102,241,0.15)",
  green:    "#10b981",
  greenDim: "rgba(16,185,129,0.15)",
  red:      "#f43f5e",
  redDim:   "rgba(244,63,94,0.15)",
  amber:    "#f59e0b",
  cyan:     "#22d3ee",
  violet:   "#a855f7",
  teal:     "#14b8a6",
  textPri:  "#f1f5f9",
  textSec:  "#94a3b8",
  textDim:  "#475569",
  gridLine: "rgba(42,48,68,0.8)",
};

/* palette for multi-series / sectors */
const PALETTE = [
  T.green, T.amber, "#3b82f6", "#8b5cf6",
  T.red,   T.cyan,  T.teal,   T.accent,
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* ═══ CSS INJECTION ══════════════════════════════════════════════════════════ */
if (typeof document !== "undefined" && !document.getElementById("ad-dark-css")) {
  const s = document.createElement("style");
  s.id = "ad-dark-css";
  s.textContent = `
    .ad-spin { animation: ad-spin 1s linear infinite; }
    @keyframes ad-spin { to { transform: rotate(360deg); } }
    .ad-fade-in { animation: ad-fade 0.4s ease; }
    @keyframes ad-fade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
    .ad-tab-active {
      background: #6366f1 !important;
      color: #fff !important;
      box-shadow: 0 4px 16px rgba(99,102,241,0.35);
    }
    .ad-tab {
      padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 600;
      cursor: pointer; border: none; white-space: nowrap; transition: all .2s;
      background: #12162a; color: #94a3b8;
      font-family: var(--font-sans, sans-serif);
    }
    .ad-tab:hover:not(.ad-tab-active) { background: #1e2438; color: #f1f5f9; }
    .recharts-legend-item-text { font-size: 10px !important; font-weight: 700 !important; letter-spacing: 0.1em !important; text-transform: uppercase !important; }
  `;
  document.head.appendChild(s);
}

/* ═══ HELPERS ════════════════════════════════════════════════════════════════ */
function fmt(n) {
  if (n === undefined || n === null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return Number(n).toLocaleString("en-PK", { maximumFractionDigits: 0 });
}

function truncate(str, max = 14) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function badge(val) {
  if (val > 0)  return <span style={{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,background:T.greenDim,color:T.green}}>▲ {val}%</span>;
  if (val < 0)  return <span style={{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,background:T.redDim,color:T.red}}>▼ {Math.abs(val)}%</span>;
  return <span style={{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,background:"rgba(42,48,68,0.8)",color:T.textDim}}>—</span>;
}

/* ═══ CHART PRIMITIVES ═══════════════════════════════════════════════════════ */

/** Dark glassmorphism tooltip */
function DarkTooltip({ active, payload, label, currency = "PKR" }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(13,16,32,0.95)", backdropFilter: "blur(16px)",
      border: `1px solid ${T.border}`,
      borderRadius: 12, padding: "12px 16px", minWidth: 160,
      boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
    }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: T.textDim, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
        {label}
      </p>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: T.textSec }}>{p.name}</span>
          </div>
          <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: T.textPri }}>
            {currency} {fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Custom X-axis tick: truncate + full name on tooltip (via title) */
function SmartXTick({ x, y, payload, maxLen = 12, rotate = -30 }) {
  const full  = payload?.value ?? "";
  const short = truncate(full, maxLen);
  const needsRotate = full.length > maxLen;
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{full}</title>
      <text
        transform={needsRotate ? `rotate(${rotate})` : undefined}
        textAnchor={needsRotate ? "end" : "middle"}
        x={0} y={0} dy={needsRotate ? 4 : 14}
        fill={T.textSec} fontSize={10} fontWeight={600}
      >
        {short}
      </text>
    </g>
  );
}

/** Y-axis common props */
const yAxis = {
  tick: { fill: T.textDim, fontSize: 10, fontWeight: 600 },
  axisLine: false, tickLine: false,
  tickFormatter: fmt, width: 60,
};

/** CartesianGrid common props */
const grid = { stroke: T.gridLine, strokeDasharray: "3 3", vertical: false };

/* Dark cursor for bar charts */
const barCursor = { fill: "rgba(99,102,241,0.06)", radius: 8 };

/* ── Spinner ── */
function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "64px 0" }}>
      <div className="ad-spin" style={{
        width: 32, height: 32, borderRadius: "50%",
        border: `2px solid ${T.accentGl}`,
        borderTopColor: T.accent,
      }} />
    </div>
  );
}

/* ── Dark Card ── */
function DCard({ title, children, style = {} }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 16, padding: "20px",
      ...style,
    }}>
      {title && (
        <p style={{
          fontSize: 10, fontWeight: 700, color: T.textDim,
          letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 16,
        }}>
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

/* ── KPI Card ── */
function KpiCard({ label, value, growth, color = T.accent, glow }) {
  const g = glow || `${color}22`;
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 16, padding: "18px 20px",
      position: "relative", overflow: "hidden",
      transition: "border-color .2s",
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = `${color}44`}
      onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
    >
      {/* glow orb */}
      <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: g, filter: "blur(24px)", pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "center", justifyBox: "space-between", marginBottom: 10 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: T.textDim, letterSpacing: "0.18em", textTransform: "uppercase" }}>{label}</p>
      </div>
      <p style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 800, color, letterSpacing: "-0.02em", marginBottom: 8 }}>
        PKR {fmt(value)}
      </p>
      {growth !== undefined && <div>{badge(growth)}</div>}
    </div>
  );
}

/* ── Donut chart with inner label ── */
function DonutChart({ data, colors, height = 260, label = "" }) {
  const total = useMemo(() => data.reduce((s, d) => s + (d.value || 0), 0), [data]);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <defs>
          {colors.map((c, i) => (
            <radialGradient key={i} id={`dg-${i}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={c} stopOpacity={0.9} />
              <stop offset="100%" stopColor={c} stopOpacity={0.6} />
            </radialGradient>
          ))}
        </defs>
        <Pie
          data={data} cx="50%" cy="50%"
          innerRadius="55%" outerRadius="75%"
          paddingAngle={3} dataKey="value"
          animationBegin={0} animationDuration={900}
        >
          {data.map((_, i) => <Cell key={i} fill={`url(#dg-${i})`} stroke="none" />)}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0];
            const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : 0;
            return (
              <div style={{
                background: "rgba(13,16,32,0.95)", backdropFilter: "blur(16px)",
                border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px",
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: T.textPri, marginBottom: 4 }}>{p.name}</p>
                <p style={{ fontFamily: "monospace", fontSize: 12, color: p.fill }}>{fmt(p.value)} ({pct}%)</p>
              </div>
            );
          }}
        />
        {/* inner text — rendered via foreignObject */}
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
          <tspan x="50%" dy="-6" fontSize="13" fontWeight="800" fill={T.textPri}>{fmt(total)}</tspan>
          <tspan x="50%" dy="18" fontSize="9" fontWeight="600" fill={T.textDim} letterSpacing="0.12em" textTransform="uppercase">{label}</tspan>
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ═══ TABS ═══════════════════════════════════════════════════════════════════ */
const TABS = [
  { id: "trends",      label: "📈 Trends" },
  { id: "comparative", label: "📊 Comparative" },
  { id: "vertical",    label: "🔢 Vertical" },
  { id: "sectors",     label: "🏭 Sectors" },
  { id: "operations",  label: "📦 Operations" },
  { id: "budget",      label: "🎯 Budget" },
  { id: "variance",    label: "📉 Variance" },
];

/* ═══════════════════════════════════════════════════════════════════════════
   TREND TAB
═══════════════════════════════════════════════════════════════════════════ */
function TrendTab({ companyId }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [months, setMonths] = useState(12);

  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(() => { if (!ignore) setLoading(true); });
    analyticsApi.getTrends(companyId, months)
      .then(res => { if (!ignore) setData(res); })
      .catch(console.error)
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [companyId, months]);

  if (loading && !data.length) return <Spinner />;
  const latest = data[data.length - 1] || {};

  return (
    <div className="ad-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <KpiCard label="Revenue"    value={latest.revenue}  growth={latest.revenue_growth}  color={T.green} />
        <KpiCard label="Expenses"   value={latest.expenses} growth={latest.expense_growth}  color={T.red} />
        <KpiCard label="Net Profit" value={latest.profit}   growth={latest.profit_growth}   color={T.accent} />
      </div>

      {/* period toggle */}
      <div style={{ display: "flex", gap: 8 }}>
        {[3, 6, 12].map(m => (
          <button key={m} onClick={() => setMonths(m)}
            style={{
              padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700,
              border: "none", cursor: "pointer", transition: "all .2s",
              background: months === m ? T.accent : T.card,
              color: months === m ? "#fff" : T.textSec,
              boxShadow: months === m ? `0 4px 16px ${T.accentGl}` : "none",
            }}
          >
            {m}M
          </button>
        ))}
      </div>

      {/* ── Area Chart — Revenue / Profit trajectory ── */}
      <DCard title="Revenue · Expenses · Profit Trajectory">
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={T.green} stopOpacity={0.28} />
                <stop offset="95%" stopColor={T.green} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gProf" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={T.accent} stopOpacity={0.24} />
                <stop offset="95%" stopColor={T.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...grid} />
            <XAxis dataKey="label" tick={{ fill: T.textDim, fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} dy={8} />
            <YAxis {...yAxis} />
            <Tooltip content={<DarkTooltip />} />
            <Legend iconType="circle" verticalAlign="top" align="right"
              wrapperStyle={{ paddingBottom: 16, fontSize: 10 }} />
            <Area type="monotone" dataKey="revenue"  name="Revenue"       stroke={T.green}  strokeWidth={3} fill="url(#gRev)"  dot={false} activeDot={{ r: 5, fill: T.green, stroke: T.card, strokeWidth: 2 }} animationDuration={1200} />
            <Area type="monotone" dataKey="profit"   name="Net Profit"    stroke={T.accent} strokeWidth={3} fill="url(#gProf)" dot={false} activeDot={{ r: 5, fill: T.accent, stroke: T.card, strokeWidth: 2 }} animationDuration={1200} />
            <Line type="monotone" dataKey="expenses" name="Expenses"      stroke={T.red}    strokeWidth={2} strokeDasharray="5 4" dot={false} animationDuration={1200} />
          </AreaChart>
        </ResponsiveContainer>
      </DCard>

      {/* ── Bar Chart — Monthly profit ── */}
      <DCard title="Monthly Profit">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="label" tick={{ fill: T.textDim, fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} dy={8} />
            <YAxis {...yAxis} />
            <Tooltip content={<DarkTooltip />} cursor={barCursor} />
            <Bar dataKey="profit" name="Profit" radius={[5, 5, 0, 0]} barSize={22} animationDuration={900}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.profit >= 0 ? T.green : T.red}
                  style={{ filter: `drop-shadow(0 4px 6px ${d.profit >= 0 ? T.greenDim : T.redDim})` }} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </DCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPARATIVE TAB
═══════════════════════════════════════════════════════════════════════════ */
function ComparativeTab({ companyId }) {
  const now = new Date();
  const [p1, setP1] = useState({ month: now.getMonth(), year: now.getFullYear() });
  const [p2, setP2] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    analyticsApi.getComparative(companyId, p1, p2)
      .then(setData).catch(console.error).finally(() => setLoading(false));
  }, [companyId, p1, p2]);

  useEffect(() => { let ig=false; Promise.resolve().then(()=>{if(!ig)setLoading(true);}); analyticsApi.getComparative(companyId,p1,p2).then(r=>{if(!ig)setData(r)}).catch(console.error).finally(()=>{if(!ig)setLoading(false);}); return()=>{ig=true}; }, [companyId,p1,p2]);

  return (
    <div className="ad-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* period pickers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {[["Period 1", p1, setP1], ["Period 2", p2, setP2]].map(([lbl, val, set]) => (
          <DCard key={lbl} title={lbl}>
            <div style={{ display: "flex", gap: 8 }}>
              <select value={val.month} onChange={e=>set(v=>({...v,month:+e.target.value}))}
                style={{ flex:1, background:T.cardDeep, border:`1px solid ${T.border}`, borderRadius:8, color:T.textPri, fontSize:13, padding:"8px 10px", outline:"none" }}>
                {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
              </select>
              <input type="number" value={val.year} onChange={e=>set(v=>({...v,year:+e.target.value}))}
                style={{ width:80, background:T.cardDeep, border:`1px solid ${T.border}`, borderRadius:8, color:T.textPri, fontSize:13, padding:"8px 10px", outline:"none" }} />
            </div>
          </DCard>
        ))}
      </div>
      <button onClick={load}
        style={{ alignSelf:"flex-start", padding:"9px 20px", borderRadius:10, border:"none",
          background:`linear-gradient(135deg,${T.accent},${T.accentLt})`, color:"#fff", fontSize:13, fontWeight:700,
          cursor:"pointer", boxShadow:`0 4px 16px ${T.accentGl}` }}>
        Compare →
      </button>

      {loading && <Spinner />}

      {!loading && data && Object.entries(data).map(([type, rows]) => (
        <DCard key={type} title={type}>
          {/* mini grouped bar for this account type */}
          {rows.length > 0 && (
            <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 32)}>
              <BarChart layout="vertical"
                data={rows.map(r=>({ name: r.account_name, p1: Math.abs(r.period1?.net||0), p2: Math.abs(r.period2?.net||0) }))}
                margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid {...grid} horizontal={false} vertical />
                <XAxis type="number" tick={{ fill: T.textDim, fontSize: 9 }} tickFormatter={fmt} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={120}
                  tick={({ x, y, payload }) => (
                    <g transform={`translate(${x},${y})`}>
                      <title>{payload.value}</title>
                      <text x={-4} y={0} dy={4} textAnchor="end" fill={T.textSec} fontSize={9} fontWeight={600}>
                        {truncate(payload.value, 16)}
                      </text>
                    </g>
                  )}
                  axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTooltip />} cursor={barCursor} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                <Bar dataKey="p1" name="Period 1" fill={T.accent} radius={[0,4,4,0]} barSize={10} animationDuration={800} />
                <Bar dataKey="p2" name="Period 2" fill={T.green}  radius={[0,4,4,0]} barSize={10} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {/* detail table */}
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {["Account","Period 1","Period 2","Variance","%"].map(h => (
                    <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontWeight:700, fontSize:9, color:T.textDim, letterSpacing:".15em", textTransform:"uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.account_id} style={{ borderBottom:`1px solid ${T.borderLo}` }}>
                    <td style={{ padding:"9px 10px", color:T.textSec }}>{r.account_name}</td>
                    <td style={{ padding:"9px 10px", fontFamily:"monospace", color:T.textDim, textAlign:"right" }}>{fmt(r.period1?.net)}</td>
                    <td style={{ padding:"9px 10px", fontFamily:"monospace", color:T.textPri, textAlign:"right" }}>{fmt(r.period2?.net)}</td>
                    <td style={{ padding:"9px 10px", fontFamily:"monospace", color:r.variance>=0?T.green:T.red, textAlign:"right" }}>{fmt(r.variance)}</td>
                    <td style={{ padding:"9px 10px", textAlign:"right" }}>{badge(r.variance_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DCard>
      ))}
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

  useEffect(() => { let ig=false; Promise.resolve().then(()=>{if(!ig)setLoading(true);}); analyticsApi.getVertical(companyId,month,year).then(r=>{if(!ig)setData(r)}).catch(console.error).finally(()=>{if(!ig)setLoading(false);}); return()=>{ig=true}; }, [companyId,month,year]);

  const renderSection = (title, items, total, accent) => (
    <DCard title={`${title} — Total: ${fmt(total)}`}>
      {/* horizontal bar chart */}
      <ResponsiveContainer width="100%" height={Math.max(120, items.length * 36)}>
        <BarChart layout="vertical"
          data={items.map(it=>({ name: it.account_name, pct: it.percentage, amount: Math.abs(it.amount) }))}
          margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
          <XAxis type="number" domain={[0,100]} tickFormatter={v=>`${v}%`}
            tick={{ fill:T.textDim, fontSize:9 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={130}
            tick={({ x, y, payload }) => (
              <g transform={`translate(${x},${y})`}>
                <title>{payload.value}</title>
                <text x={-6} y={0} dy={4} textAnchor="end" fill={T.textSec} fontSize={9} fontWeight={600}>
                  {truncate(payload.value, 18)}
                </text>
              </g>
            )}
            axisLine={false} tickLine={false} />
          <Tooltip content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0]?.payload;
            return (
              <div style={{ background:"rgba(13,16,32,0.95)", backdropFilter:"blur(16px)", border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 14px" }}>
                <p style={{ fontSize:11, fontWeight:700, color:T.textPri, marginBottom:4 }}>{p.name}</p>
                <p style={{ fontFamily:"monospace", fontSize:11, color:accent }}>PKR {fmt(p.amount)} ({p.pct}%)</p>
              </div>
            );
          }} />
          <Bar dataKey="pct" name="% Share" fill={accent} radius={[0,5,5,0]} barSize={14} animationDuration={900}
            label={{ position:"right", fill:T.textSec, fontSize:9, formatter:v=>`${v}%` }} />
        </BarChart>
      </ResponsiveContainer>
    </DCard>
  );

  return (
    <div className="ad-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize:10, color:T.textDim, marginBottom:4, fontWeight:600, textTransform:"uppercase", letterSpacing:".1em" }}>Month</p>
          <select value={month} onChange={e=>setMonth(+e.target.value)}
            style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:8, color:T.textPri, fontSize:13, padding:"8px 12px", outline:"none" }}>
            {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
          </select>
        </div>
        <div>
          <p style={{ fontSize:10, color:T.textDim, marginBottom:4, fontWeight:600, textTransform:"uppercase", letterSpacing:".1em" }}>Year</p>
          <input type="number" value={year} onChange={e=>setYear(+e.target.value)}
            style={{ width:80, background:T.card, border:`1px solid ${T.border}`, borderRadius:8, color:T.textPri, fontSize:13, padding:"8px 12px", outline:"none" }} />
        </div>
        <button onClick={load}
          style={{ padding:"9px 18px", borderRadius:8, border:"none", background:T.accent, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
          Analyze
        </button>
      </div>
      {loading && <Spinner />}
      {!loading && data && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px,1fr))", gap: 16 }}>
          {renderSection("Income Statement (% of Revenue)", data.income_statement?.items || [], data.income_statement?.total_revenue, T.accent)}
          {renderSection("Balance Sheet (% of Total Assets)", data.balance_sheet?.items || [], data.balance_sheet?.total_assets, T.green)}
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

  useEffect(() => { let ig=false; Promise.resolve().then(()=>{if(!ig)setLoading(true);}); analyticsApi.getSectorGrowth(companyId,6).then(r=>{if(!ig)setData(r)}).catch(console.error).finally(()=>{if(!ig)setLoading(false);}); return()=>{ig=true}; }, [companyId]);

  if (loading && !data.length) return <Spinner />;

  const barData = data.map(s => ({ name: s.sector, revenue: s.periods.reduce((a,p)=>a+p.revenue,0) }));
  const total   = barData.reduce((s,d)=>s+d.revenue,0);

  return (
    <div className="ad-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {!data.length && (
        <DCard title="Sector Revenue"><p style={{ color:T.textSec, fontSize:13 }}>No sector data available. Populate with delivered sector transactions.</p></DCard>
      )}

      {/* mini trend cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 12 }}>
        {data.map((sector, si) => (
          <DCard key={sector.sector}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
              <p style={{ fontSize:12, fontWeight:700, color:T.textPri }}>{sector.sector}</p>
              {badge(sector.overall_growth_pct)}
            </div>
            <ResponsiveContainer width="100%" height={60}>
              <LineChart data={sector.periods}>
                <Line type="monotone" dataKey="revenue" stroke={PALETTE[si % PALETTE.length]}
                  strokeWidth={2.5} dot={false} animationDuration={800} />
                <Tooltip content={<DarkTooltip />} />
              </LineChart>
            </ResponsiveContainer>
            <p style={{ fontSize:10, color:T.textDim, marginTop:6 }}>
              Latest: <span style={{ color:T.textPri, fontFamily:"monospace" }}>{fmt(sector.periods[sector.periods.length-1]?.revenue)}</span>
            </p>
          </DCard>
        ))}
      </div>

      {data.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
          {/* Bar comparison */}
          <DCard title="Sector Revenue Comparison">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} margin={{ top: 4, right: 12, left: 0, bottom: 40 }}>
                <CartesianGrid {...grid} />
                <XAxis dataKey="name"
                  tick={<SmartXTick maxLen={10} rotate={-35} />}
                  interval={0} axisLine={false} tickLine={false} height={60} />
                <YAxis {...yAxis} />
                <Tooltip content={<DarkTooltip />} cursor={barCursor} />
                <Bar dataKey="revenue" name="Revenue" radius={[5,5,0,0]} barSize={28} animationDuration={900}>
                  {barData.map((_,i) => (
                    <Cell key={i} fill={PALETTE[i%PALETTE.length]}
                      style={{ filter:`drop-shadow(0 4px 8px ${PALETTE[i%PALETTE.length]}44)` }} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </DCard>

          {/* Donut distribution */}
          <DCard title="Revenue Distribution">
            <DonutChart
              data={barData.map(d=>({ name:d.name, value:d.revenue }))}
              colors={PALETTE}
              height={200}
              label="Total"
            />
            <div style={{ marginTop: 12, display:"flex", flexDirection:"column", gap:6 }}>
              {barData.map((d,i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:PALETTE[i%PALETTE.length] }} />
                    <span style={{ fontSize:11, color:T.textSec, fontWeight:600 }}>{d.name}</span>
                  </div>
                  <span style={{ fontFamily:"monospace", fontSize:10, color:T.textDim }}>
                    {total>0?((d.revenue/total)*100).toFixed(0):0}%
                  </span>
                </div>
              ))}
            </div>
          </DCard>
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

  useEffect(() => { let ig=false; Promise.resolve().then(()=>{if(!ig)setLoading(true);}); analyticsApi.getOperationalInsights(companyId).then(r=>{if(!ig)setData(r)}).catch(console.error).finally(()=>{if(!ig)setLoading(false);}); return()=>{ig=true}; }, [companyId]);

  if (loading && !data) return <Spinner />;

  const summary    = data?.summary || {};
  const products   = data?.top_products || [];
  const warehouses = data?.warehouse_load || [];
  const sectors    = data?.sector_profitability || [];

  return (
    <div className="ad-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPI grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
        {[
          { label:"SKU Count",          val:summary.total_skus,       color:T.accent,  raw:true },
          { label:"Low Stock SKUs",      val:summary.low_stock_skus,   color:T.red,     raw:true },
          { label:"Inventory Value",     val:summary.inventory_value,  color:T.green },
          { label:"Warehouses",          val:summary.warehouse_count,  color:T.cyan,    raw:true },
          { label:"Delivered Revenue",   val:summary.delivered_revenue,color:T.textPri },
          { label:"Delivered Orders",    val:summary.delivered_count,  color:T.amber,   raw:true },
        ].map(k => (
          <div key={k.label} style={{
            background:T.card, border:`1px solid ${T.border}`,
            borderRadius:14, padding:"16px 18px",
            position:"relative", overflow:"hidden",
          }}>
            <div style={{ position:"absolute",top:-16,right:-16,width:60,height:60,borderRadius:"50%",
              background:`${k.color}18`,filter:"blur(18px)",pointerEvents:"none" }} />
            <p style={{ fontSize:9, fontWeight:700, color:T.textDim, letterSpacing:".15em", textTransform:"uppercase", marginBottom:8 }}>{k.label}</p>
            <p style={{ fontFamily:"monospace", fontSize:20, fontWeight:800, color:k.color }}>
              {k.raw ? (k.val || 0) : `PKR ${fmt(k.val || 0)}`}
            </p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        {/* Products table */}
        <DCard title="Top Inventory Products (by Value)">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                  {["Product","SKU","Qty","Value"].map(h=>(
                    <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontWeight:700, fontSize:9, color:T.textDim, letterSpacing:".15em", textTransform:"uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!products.length ? (
                  <tr><td colSpan={4} style={{ textAlign:"center", padding:"24px", color:T.textDim }}>No product data</td></tr>
                ) : products.map(p => (
                  <tr key={p.product_id} style={{ borderBottom:`1px solid ${T.borderLo}` }}>
                    <td style={{ padding:"9px 10px", color:T.textPri, fontWeight:600 }}>{p.product_name}</td>
                    <td style={{ padding:"9px 10px", fontFamily:"monospace", color:T.textDim, fontSize:10 }}>{p.sku}</td>
                    <td style={{ padding:"9px 10px", fontFamily:"monospace", color:T.textSec, textAlign:"right" }}>{fmt(p.qty)}</td>
                    <td style={{ padding:"9px 10px", fontFamily:"monospace", color:T.green, textAlign:"right", fontWeight:700 }}>PKR {fmt(p.stock_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DCard>

        {/* Warehouse bar — horizontal with full label support */}
        <DCard title="Warehouse Load">
          {warehouses.length === 0 ? (
            <p style={{ color:T.textDim, fontSize:12, padding:"16px 0" }}>No warehouse data</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, warehouses.length * 48)}>
              <BarChart layout="vertical" data={warehouses}
                margin={{ top: 4, right: 50, left: 0, bottom: 4 }}>
                <CartesianGrid {...grid} horizontal={false} vertical />
                <XAxis type="number" tick={{ fill:T.textDim, fontSize:9 }} tickFormatter={fmt} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="warehouse_name" width={140}
                  tick={({ x, y, payload }) => (
                    <g transform={`translate(${x},${y})`}>
                      <title>{payload.value}</title>
                      <text x={-8} y={0} dy={4} textAnchor="end" fill={T.textSec} fontSize={9} fontWeight={600}>
                        {truncate(payload.value, 20)}
                      </text>
                    </g>
                  )}
                  axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTooltip />} cursor={barCursor} />
                <Bar dataKey="estimated_value" name="Value" fill={T.accent} radius={[0,5,5,0]} barSize={20}
                  animationDuration={900}
                  label={{ position:"right", fill:T.textSec, fontSize:9, formatter:fmt }} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </DCard>
      </div>

      {/* Sector profitability table */}
      <DCard title="Sector Profitability">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                {["Sector","Deliveries","Revenue","Gross Profit","Margin"].map(h=>(
                  <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontWeight:700, fontSize:9, color:T.textDim, letterSpacing:".15em", textTransform:"uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!sectors.length ? (
                <tr><td colSpan={5} style={{ textAlign:"center", padding:"24px", color:T.textDim }}>No sector data</td></tr>
              ) : sectors.map(s=>(
                <tr key={s.sector_id} style={{ borderBottom:`1px solid ${T.borderLo}` }}>
                  <td style={{ padding:"9px 10px", color:T.textPri, fontWeight:600 }}>{s.sector_name}</td>
                  <td style={{ padding:"9px 10px", fontFamily:"monospace", color:T.textSec, textAlign:"right" }}>{s.delivery_count}</td>
                  <td style={{ padding:"9px 10px", fontFamily:"monospace", color:T.textPri, textAlign:"right" }}>PKR {fmt(s.total_revenue)}</td>
                  <td style={{ padding:"9px 10px", fontFamily:"monospace", color:s.gross_profit>=0?T.green:T.red, textAlign:"right" }}>PKR {fmt(s.gross_profit)}</td>
                  <td style={{ padding:"9px 10px", textAlign:"right" }}>{badge(s.margin_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   BUDGET TAB
═══════════════════════════════════════════════════════════════════════════ */
function BudgetTab({ companyId }) {
  const now = new Date();
  const [year,setYear]     = useState(now.getFullYear());
  const [month,setMonth]   = useState(now.getMonth()+1);
  const [budgets,setBudgets] = useState([]);
  const [loading,setLoading] = useState(false);
  const [form,setForm] = useState({ budget_type:"account",account_id:"",sector_id:"",period_month:now.getMonth()+1,period_year:now.getFullYear(),budget_amount:"",notes:"" });
  const [saving,setSaving] = useState(false);

  const load = useCallback(()=>{ setLoading(true); analyticsApi.getBudgets(companyId,year,month).then(setBudgets).catch(console.error).finally(()=>setLoading(false)); },[companyId,year,month]);
  useEffect(()=>{ let ig=false; Promise.resolve().then(()=>{if(!ig)setLoading(true);}); analyticsApi.getBudgets(companyId,year,month).then(r=>{if(!ig)setBudgets(r)}).catch(console.error).finally(()=>{if(!ig)setLoading(false);}); return()=>{ig=true}; },[companyId,year,month]);

  const save = async()=>{ if(!form.budget_amount)return; setSaving(true); try{await analyticsApi.createBudget(companyId,form);load();setForm(f=>({...f,budget_amount:"",notes:""}))}catch(e){alert(e.message)}finally{setSaving(false)}};
  const remove=async id=>{ if(!confirm("Delete budget?"))return; await analyticsApi.deleteBudget(companyId,id); load(); };

  const inp = { background:T.cardDeep, border:`1px solid ${T.border}`, borderRadius:8, color:T.textPri, fontSize:13, padding:"9px 12px", outline:"none", width:"100%", boxSizing:"border-box" };

  return (
    <div className="ad-fade-in" style={{ display:"flex",flexDirection:"column",gap:16 }}>
      <DCard title="Add / Update Budget">
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12 }}>
          {[
            { lbl:"Type", el:<select value={form.budget_type} onChange={e=>setForm(f=>({...f,budget_type:e.target.value}))} style={inp}><option value="account">Account</option><option value="sector">Sector</option></select> },
            form.budget_type==="account"
              ? { lbl:"Account ID", el:<input value={form.account_id} onChange={e=>setForm(f=>({...f,account_id:e.target.value}))} placeholder="e.g. 42" style={inp}/> }
              : { lbl:"Sector", el:<input value={form.sector_id} onChange={e=>setForm(f=>({...f,sector_id:e.target.value}))} placeholder="e.g. Textile" style={inp}/> },
            { lbl:"Month", el:<select value={form.period_month} onChange={e=>setForm(f=>({...f,period_month:+e.target.value}))} style={inp}>{MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}</select> },
            { lbl:"Year", el:<input type="number" value={form.period_year} onChange={e=>setForm(f=>({...f,period_year:+e.target.value}))} style={inp}/> },
            { lbl:"Budget Amount (PKR)", el:<input type="number" value={form.budget_amount} onChange={e=>setForm(f=>({...f,budget_amount:e.target.value}))} placeholder="0" style={inp}/> },
            { lbl:"Notes", el:<input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Optional" style={inp}/> },
          ].map(f=>(
            <div key={f.lbl}>
              <p style={{ fontSize:9,color:T.textDim,marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:".12em" }}>{f.lbl}</p>
              {f.el}
            </div>
          ))}
        </div>
        <button onClick={save} disabled={saving}
          style={{ marginTop:16, padding:"9px 22px",borderRadius:10,border:"none",
            background:saving?T.border:`linear-gradient(135deg,${T.accent},${T.accentLt})`,
            color:"#fff",fontSize:13,fontWeight:700,cursor:saving?"not-allowed":"pointer",
            boxShadow:saving?"none":`0 4px 16px ${T.accentGl}` }}>
          {saving?"Saving…":"Save Budget"}
        </button>
      </DCard>

      {/* filter */}
      <div style={{ display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap" }}>
        <div>
          <p style={{ fontSize:9,color:T.textDim,marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:".12em" }}>Month</p>
          <select value={month} onChange={e=>setMonth(+e.target.value)} style={{ ...inp, width:"auto" }}>
            {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
          </select>
        </div>
        <div>
          <p style={{ fontSize:9,color:T.textDim,marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:".12em" }}>Year</p>
          <input type="number" value={year} onChange={e=>setYear(+e.target.value)} style={{ ...inp, width:90 }} />
        </div>
        <button onClick={load} style={{ padding:"9px 18px",borderRadius:8,border:`1px solid ${T.border}`,background:T.card,color:T.textSec,fontSize:12,fontWeight:700,cursor:"pointer" }}>Filter</button>
      </div>

      {loading && <Spinner />}
      {!loading && (
        <DCard title={`Budgets — ${MONTHS[month-1]} ${year}`}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                  {["Account / Sector","Type","Budget","Period","Action"].map(h=>(
                    <th key={h} style={{ padding:"8px 10px",textAlign:"left",fontWeight:700,fontSize:9,color:T.textDim,letterSpacing:".15em",textTransform:"uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!budgets.length && <tr><td colSpan={5} style={{ textAlign:"center",padding:"24px",color:T.textDim }}>No budgets for this period</td></tr>}
                {budgets.map(b=>(
                  <tr key={b.id} style={{ borderBottom:`1px solid ${T.borderLo}` }}>
                    <td style={{ padding:"9px 10px",color:T.textPri,fontWeight:600 }}>{b.account_name||(b.account_id?`Account #${b.account_id}`:b.sector_id)||"—"}</td>
                    <td style={{ padding:"9px 10px",color:T.textSec }}>{b.budget_type}</td>
                    <td style={{ padding:"9px 10px",fontFamily:"monospace",color:T.accent,fontWeight:700,textAlign:"right" }}>PKR {fmt(b.budget_amount)}</td>
                    <td style={{ padding:"9px 10px",color:T.textDim,textAlign:"right" }}>{MONTHS[b.period_month-1]} {b.period_year}</td>
                    <td style={{ padding:"9px 10px",textAlign:"center" }}>
                      <button onClick={()=>remove(b.id)} style={{ background:"none",border:"none",color:T.red,fontSize:11,fontWeight:700,cursor:"pointer" }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DCard>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VARIANCE TAB
═══════════════════════════════════════════════════════════════════════════ */
function VarianceTab({ companyId }) {
  const now = new Date();
  const [year,setYear]   = useState(now.getFullYear());
  const [month,setMonth] = useState(now.getMonth()+1);
  const [data,setData]   = useState(null);
  const [loading,setLoading] = useState(true);

  const load = useCallback(()=>{ setLoading(true); analyticsApi.getBudgetVsActual(companyId,year,month).then(setData).catch(console.error).finally(()=>setLoading(false)); },[companyId,year,month]);
  useEffect(()=>{ let ig=false; Promise.resolve().then(()=>{if(!ig)setLoading(true);}); analyticsApi.getBudgetVsActual(companyId,year,month).then(r=>{if(!ig)setData(r)}).catch(console.error).finally(()=>{if(!ig)setLoading(false);}); return()=>{ig=true}; },[companyId,year,month]);

  const inp = { background:T.cardDeep, border:`1px solid ${T.border}`, borderRadius:8, color:T.textPri, fontSize:13, padding:"9px 12px", outline:"none" };

  return (
    <div className="ad-fade-in" style={{ display:"flex",flexDirection:"column",gap:16 }}>
      <div style={{ display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap" }}>
        <div>
          <p style={{ fontSize:9,color:T.textDim,marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:".12em" }}>Month</p>
          <select value={month} onChange={e=>setMonth(+e.target.value)} style={inp}>
            {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
          </select>
        </div>
        <div>
          <p style={{ fontSize:9,color:T.textDim,marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:".12em" }}>Year</p>
          <input type="number" value={year} onChange={e=>setYear(+e.target.value)} style={{ ...inp,width:90 }} />
        </div>
        <button onClick={load} style={{ padding:"9px 18px",borderRadius:8,border:"none",background:T.accent,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer" }}>Load</button>
      </div>

      {loading && <Spinner />}
      {!loading && data && (
        <>
          {/* summary KPIs */}
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14 }}>
            <KpiCard label="Total Budget" value={data.summary?.total_budget}   color={T.accent} />
            <KpiCard label="Total Actual" value={data.summary?.total_actual}   color={T.textPri} />
            <KpiCard label="Variance"     value={data.summary?.total_variance}
              color={data.summary?.total_variance>=0?T.green:T.red}
              growth={data.summary?.total_variance_pct} />
          </div>

          {/* ── Budget vs Actual grouped bar ── */}
          {data.items?.length > 0 && (
            <DCard title="Budget vs Actual — Side by Side">
              <ResponsiveContainer width="100%" height={Math.max(260, data.items.length * 44)}>
                <BarChart
                  layout="vertical"
                  data={data.items.map(r=>({ name:r.account_name||r.sector_id, budget:+r.budget_amount||0, actual:+r.actual_amount||0 }))}
                  margin={{ top:4, right:60, left:0, bottom:4 }}
                >
                  <CartesianGrid {...grid} horizontal={false} vertical />
                  <XAxis type="number" tick={{ fill:T.textDim,fontSize:9 }} tickFormatter={fmt} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={150}
                    tick={({ x, y, payload }) => (
                      <g transform={`translate(${x},${y})`}>
                        <title>{payload.value}</title>
                        <text x={-8} y={0} dy={4} textAnchor="end" fill={T.textSec} fontSize={9} fontWeight={600}>
                          {truncate(payload.value, 20)}
                        </text>
                      </g>
                    )}
                    axisLine={false} tickLine={false} />
                  <Tooltip content={<DarkTooltip />} cursor={barCursor} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize:10, paddingTop:8 }} />
                  <Bar dataKey="budget" name="Budget" fill={T.accent}  radius={[0,4,4,0]} barSize={10} animationDuration={800}
                    label={{ position:"right", fill:T.textDim, fontSize:8, formatter:fmt }} />
                  <Bar dataKey="actual" name="Actual" fill={T.green}   radius={[0,4,4,0]} barSize={10} animationDuration={800}
                    label={{ position:"right", fill:T.green, fontSize:8, fontWeight:700, formatter:fmt }} />
                </BarChart>
              </ResponsiveContainer>
            </DCard>
          )}

          {/* ── Radar ── */}
          {data.items?.length > 0 && (
            <DCard title="360° Financial Performance Radar">
              <ResponsiveContainer width="100%" height={420}>
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data.items}>
                  <PolarGrid stroke={T.border} />
                  <PolarAngleAxis dataKey="account_name"
                    tick={({ x, y, payload, cx }) => {
                      const anchor = x < cx ? "end" : x > cx ? "start" : "middle";
                      return (
                        <g>
                          <title>{payload.value}</title>
                          <text x={x} y={y} textAnchor={anchor} fill={T.textSec} fontSize={9} fontWeight={600}>
                            {truncate(payload.value, 12)}
                          </text>
                        </g>
                      );
                    }}
                  />
                  <PolarRadiusAxis angle={30} domain={[0,"auto"]} tick={{ fill:T.textDim,fontSize:8 }} axisLine={false} tickLine={false} />
                  <Radar name="Budget" dataKey="budget_amount" stroke={T.textDim} strokeWidth={1.5} fill={T.border}     fillOpacity={0.15} />
                  <Radar name="Actual" dataKey="actual_amount" stroke={T.green}   strokeWidth={2.5} fill={T.green}      fillOpacity={0.25} />
                  <Tooltip contentStyle={{ background:"rgba(13,16,32,.95)",border:`1px solid ${T.border}`,borderRadius:10 }} formatter={v=>fmt(v)} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize:10,paddingTop:16,fontWeight:700,textTransform:"uppercase" }} />
                </RadarChart>
              </ResponsiveContainer>
              <div style={{ marginTop:12,padding:"10px 14px",background:T.cardDeep,borderRadius:10,textAlign:"center" }}>
                <p style={{ fontSize:9,color:T.textDim,letterSpacing:".15em",textTransform:"uppercase" }}>
                  Area outside the gray ring = budget overrun
                </p>
              </div>
            </DCard>
          )}

          {/* detail table */}
          <DCard title="Variance Detail">
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
                <thead>
                  <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                    {["Account","Budget","Actual","Variance","%","Status"].map(h=>(
                      <th key={h} style={{ padding:"8px 10px",textAlign:"left",fontWeight:700,fontSize:9,color:T.textDim,letterSpacing:".15em",textTransform:"uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.items||[]).map(row=>(
                    <tr key={row.id} style={{ borderBottom:`1px solid ${T.borderLo}` }}>
                      <td style={{ padding:"9px 10px",color:T.textPri,fontWeight:600 }}>{row.account_name||row.sector_id}</td>
                      <td style={{ padding:"9px 10px",fontFamily:"monospace",color:T.textSec,textAlign:"right" }}>{fmt(row.budget_amount)}</td>
                      <td style={{ padding:"9px 10px",fontFamily:"monospace",color:T.textPri,textAlign:"right" }}>{fmt(row.actual_amount)}</td>
                      <td style={{ padding:"9px 10px",fontFamily:"monospace",color:row.variance>=0?T.green:T.red,textAlign:"right",fontWeight:700 }}>{fmt(row.variance)}</td>
                      <td style={{ padding:"9px 10px",textAlign:"right" }}>{badge(row.variance_pct)}</td>
                      <td style={{ padding:"9px 10px" }}>
                        <span style={{ padding:"3px 10px",borderRadius:20,fontSize:10,fontWeight:700,
                          background:row.status==="favorable"?T.greenDim:T.redDim,
                          color:row.status==="favorable"?T.green:T.red }}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DCard>
        </>
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
    <div style={{ minHeight:"100vh", background:T.bg, padding:"32px 28px 72px", fontFamily:"var(--font-sans,sans-serif)" }}>

      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontFamily:"var(--font-display,sans-serif)", fontSize:22, fontWeight:800, color:T.textPri, letterSpacing:"-.02em", margin:0 }}>
          Analytics &amp; Planning
        </h1>
        <p style={{ fontSize:13, color:T.textSec, marginTop:4 }}>
          Trends · Budgets · Variance — sourced from Ledger
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:24, overflowX:"auto", paddingBottom:4 }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`ad-tab${activeTab===tab.id?" ad-tab-active":""}`}>
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