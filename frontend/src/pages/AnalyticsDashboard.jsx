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
  ResponsiveContainer, Cell, PieChart, Pie,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import { analyticsApi } from "../services/analyticsApi";
import useAuthStore from "../store/authStore";

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
  gridLine:  "#f1f5f9",
};

const PALETTE = [
  "#3b82f6","#10b981","#f59e0b","#8b5cf6",
  "#ef4444","#06b6d4","#14b8a6","#f43f5e",
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
  `;
  document.head.appendChild(s);
}

/* ═══ HELPERS ════════════════════════════════════════════════════════════════ */
function fmt(n, short = true) {
  if (n === undefined || n === null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (short) {
    if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (abs >= 1_000) return (n / 1_000).toFixed(1) + "K";
  }
  return Number(n).toLocaleString("en-PK", { maximumFractionDigits: 0 });
}

function trunc(str, max = 14) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "…" : str;
}

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
const yStyle = {
  tick: { fill: W.textDim, fontSize: 11, fontWeight: 500 },
  axisLine: false, tickLine: false, tickFormatter: fmt, width: 56,
};
const xStyle = (extra = {}) => ({
  tick: { fill: W.textDim, fontSize: 11, fontWeight: 500 },
  axisLine: false, tickLine: false, ...extra,
});

function WhiteTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#fff", border: `1px solid ${W.border}`,
      borderRadius: 12, padding: "10px 16px", minWidth: 160,
      boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
    }}>
      <p style={{ fontSize:11, fontWeight:700, color:W.textDim, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:14, marginBottom:3 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:8, height:8, borderRadius:2, background:p.color }} />
            <span style={{ fontSize:12, color:W.textSec }}>{p.name}</span>
          </div>
          <span style={{ fontFamily:"monospace", fontSize:12, fontWeight:700, color:W.textPri }}>
            PKR {fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function SmartYTick({ x, y, payload }) {
  const full = payload?.value ?? "";
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{full}</title>
      <text x={-6} y={0} dy={4} textAnchor="end" fill={W.textDim} fontSize={11} fontWeight={500}>
        {trunc(full, 18)}
      </text>
    </g>
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

/* ── Donut with inner label ── */
function DonutChart({ data, colors, height = 200, centerLabel = "", centerValue = "" }) {
  const total = useMemo(() => data.reduce((s, d) => s + (d.value || 0), 0), [data]);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%"
          innerRadius="56%" outerRadius="78%"
          paddingAngle={2} dataKey="value"
          animationBegin={0} animationDuration={800} strokeWidth={0}>
          {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
        </Pie>
        <Tooltip content={({ active, payload }) => {
          if (!active || !payload?.length) return null;
          const p = payload[0];
          const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : 0;
          return (
            <div style={{ background:"#fff", border:`1px solid ${W.border}`, borderRadius:10, padding:"8px 12px", boxShadow:"0 8px 24px rgba(0,0,0,0.1)" }}>
              <p style={{ fontSize:12, fontWeight:700, color:W.textPri, marginBottom:2 }}>{p.name}</p>
              <p style={{ fontFamily:"monospace", fontSize:12, color:p.payload.fill }}>{fmt(p.value)} ({pct}%)</p>
            </div>
          );
        }} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
          <tspan x="50%" dy="-8" fontSize="18" fontWeight="800" fill={W.textPri}>{centerValue || fmt(total)}</tspan>
          <tspan x="50%" dy="20" fontSize="11" fill={W.textSec}>{centerLabel}</tspan>
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ── Table ── */
function DataTable({ headers, rows, emptyMsg = "No data available." }) {
  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
        <thead>
          <tr style={{ background:"#f8fafc", borderBottom:`1.5px solid ${W.border}` }}>
            {headers.map((h,i) => (
              <th key={i} style={{
                padding:"10px 14px", textAlign: h.right?"right":"left",
                fontWeight:700, fontSize:11, color:W.textSec,
                letterSpacing:"0.08em", textTransform:"uppercase",
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
        actions={<span style={{ fontSize:11, color:W.textDim }}>Last {months} months</span>}>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top:8, right:8, left:0, bottom:0 }}>
            <defs>
              <linearGradient id="wgRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={W.accent} stopOpacity={0.18} />
                <stop offset="95%" stopColor={W.accent} stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="wgProf" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.16} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={W.gridLine} vertical={false} />
            <XAxis dataKey="label" {...xStyle({ dy:8 })} />
            <YAxis {...yStyle} />
            <Tooltip content={<WhiteTooltip />} cursor={{ stroke:W.border, strokeWidth:1 }} />
            <Legend iconType="circle" verticalAlign="top" align="right"
              wrapperStyle={{ paddingBottom:16, fontSize:11 }} />
            <Area type="monotone" dataKey="revenue" name="Revenue"
              stroke={W.accent} strokeWidth={2.5} fill="url(#wgRev)"
              dot={false} activeDot={{ r:5, fill:W.accent, stroke:"#fff", strokeWidth:2 }} />
            <Area type="monotone" dataKey="profit" name="Net Profit"
              stroke="#10b981" strokeWidth={2.5} fill="url(#wgProf)"
              dot={false} activeDot={{ r:5, fill:"#10b981", stroke:"#fff", strokeWidth:2 }} />
            <Line type="monotone" dataKey="expenses" name="Expenses"
              stroke="#ef4444" strokeWidth={2} strokeDasharray="6 3" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Monthly profit bars */}
      <Card title="Monthly Profit">
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={data} margin={{ top:4, right:8, left:0, bottom:0 }}>
            <CartesianGrid stroke={W.gridLine} vertical={false} />
            <XAxis dataKey="label" {...xStyle({ dy:8 })} />
            <YAxis {...yStyle} />
            <Tooltip content={<WhiteTooltip />} cursor={{ fill:"#f8fafc" }} />
            <Bar dataKey="profit" name="Profit" radius={[6,6,0,0]} barSize={20}>
              {data.map((d, i) => <Cell key={i} fill={d.profit >= 0 ? "#10b981" : "#ef4444"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
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
  const [data, setData]   = useState(null);
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

  const sel = (val, setter) => (
    <div style={{ display:"flex", gap:8 }}>
      <select value={val.month} onChange={e => setter(v => ({ ...v, month: +e.target.value }))} className="aw-inp" style={{ flex:1 }}>
        {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
      </select>
      <input type="number" value={val.year} onChange={e => setter(v => ({ ...v, year: +e.target.value }))}
        className="aw-inp" style={{ width:84 }} />
    </div>
  );

  return (
    <div className="aw-fade" style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <Card title="Select Periods to Compare">
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
          <div>
            <p style={{ fontSize:11, fontWeight:700, color:W.textSec, textTransform:"uppercase", letterSpacing:".1em", marginBottom:6 }}>Period 1</p>
            {sel(p1, setP1)}
          </div>
          <div>
            <p style={{ fontSize:11, fontWeight:700, color:W.textSec, textTransform:"uppercase", letterSpacing:".1em", marginBottom:6 }}>Period 2</p>
            {sel(p2, setP2)}
          </div>
        </div>
        <button onClick={load} className="aw-btn-primary">Compare Periods →</button>
      </Card>

      {loading && <Spinner />}

      {!loading && data && Object.entries(data).map(([type, rows]) => (
        <Card key={type} title={type}>
          {rows.length > 0 && (
            <ResponsiveContainer width="100%" height={Math.max(140, rows.length * 30)}>
              <BarChart layout="vertical"
                data={rows.map(r => ({ name: r.account_name, p1: Math.abs(r.period1?.net||0), p2: Math.abs(r.period2?.net||0) }))}
                margin={{ top:0, right:16, left:0, bottom:0 }}>
                <CartesianGrid stroke={W.gridLine} horizontal={false} />
                <XAxis type="number" {...xStyle({})} tickFormatter={fmt} />
                <YAxis type="category" dataKey="name" width={130} tick={<SmartYTick />} axisLine={false} tickLine={false} />
                <Tooltip content={<WhiteTooltip />} cursor={{ fill:"#f8fafc" }} />
                <Legend iconType="square" wrapperStyle={{ fontSize:11 }} />
                <Bar dataKey="p1" name="Period 1" fill={W.accent}   radius={[0,4,4,0]} barSize={11} />
                <Bar dataKey="p2" name="Period 2" fill="#10b981" radius={[0,4,4,0]} barSize={11} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div style={{ marginTop:14 }}>
            <DataTable
              headers={[
                { label:"Account" },
                { label:"Period 1", right:true },
                { label:"Period 2", right:true },
                { label:"Variance", right:true },
                { label:"%", right:true },
              ]}
              rows={rows.map(r => [
                { node: <span style={{ fontWeight:600, color:W.textPri }}>{r.account_name}</span> },
                { node: <span style={{ fontFamily:"monospace", color:W.textSec }}>{fmt(r.period1?.net)}</span>, style:{textAlign:"right"} },
                { node: <span style={{ fontFamily:"monospace" }}>{fmt(r.period2?.net)}</span>, style:{textAlign:"right"} },
                { node: <span style={{ fontFamily:"monospace", fontWeight:700, color:r.variance>=0?W.green:W.red }}>{fmt(r.variance)}</span>, style:{textAlign:"right"} },
                { node: <Badge val={r.variance_pct} />, style:{textAlign:"right"} },
              ])}
            />
          </div>
        </Card>
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

  useEffect(() => {
    let ig = false;
    Promise.resolve().then(() => { if (!ig) setLoading(true); });
    analyticsApi.getVertical(companyId, month, year).then(r => { if (!ig) setData(r); })
      .catch(console.error).finally(() => { if (!ig) setLoading(false); });
    return () => { ig = true; };
  }, [companyId, month, year]);

  const renderSection = (title, items, total, color) => (
    <Card title={title} subtitle={`Total: PKR ${fmt(total)}`}>
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
            <div style={{ height:"100%", width:`${Math.min(item.percentage, 100)}%`, background:color, borderRadius:4, transition:"width .5s ease" }} />
          </div>
        </div>
      ))}
    </Card>
  );

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
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(340px,1fr))", gap:16 }}>
          {renderSection("Income Statement (% of Revenue)", data.income_statement?.items || [], data.income_statement?.total_revenue, W.accent)}
          {renderSection("Balance Sheet (% of Total Assets)", data.balance_sheet?.items || [], data.balance_sheet?.total_assets, "#10b981")}
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

  if (loading && !data.length) return <Spinner />;

  const barData = data.map(s => ({ name: s.sector, revenue: s.periods.reduce((a, p) => a + p.revenue, 0) }));
  const total   = barData.reduce((s, d) => s + d.revenue, 0);
  const donutColors = PALETTE.slice(0, data.length);

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
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} margin={{ top:4, right:8, left:0, bottom:44 }}>
                <CartesianGrid stroke={W.gridLine} vertical={false} />
                <XAxis dataKey="name"
                  tick={({ x, y, payload }) => (
                    <g transform={`translate(${x},${y})`}>
                      <title>{payload.value}</title>
                      <text transform="rotate(-35)" textAnchor="end" x={0} y={0} dy={4}
                        fill={W.textDim} fontSize={11} fontWeight={500}>
                        {trunc(payload.value, 12)}
                      </text>
                    </g>
                  )}
                  interval={0} axisLine={false} tickLine={false} height={60} />
                <YAxis {...yStyle} />
                <Tooltip content={<WhiteTooltip />} cursor={{ fill:"#f8fafc" }} />
                <Bar dataKey="revenue" name="Revenue" radius={[6,6,0,0]} barSize={32}>
                  {barData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Donut — matches reference image "Traffic Sources" */}
          <Card title="Revenue Distribution" style={{ flex:"1 1 300px" }}>
            <DonutChart data={barData.map(d => ({ name:d.name, value:d.revenue }))}
              colors={donutColors} height={180} centerLabel="Total Revenue" />
            <div style={{ marginTop:14, display:"flex", flexDirection:"column", gap:8 }}>
              {barData.map((d, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:10, height:10, borderRadius:2, background:PALETTE[i%PALETTE.length] }} />
                    <span style={{ fontSize:12, color:W.textSec, fontWeight:500 }}>{d.name}</span>
                  </div>
                  <span style={{ fontSize:12, color:W.textPri, fontFamily:"monospace", fontWeight:700 }}>
                    {total > 0 ? ((d.revenue/total)*100).toFixed(0) : 0}%
                  </span>
                </div>
              ))}
            </div>
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

      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16 }}>
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

        <Card title="Warehouse Load">
          {!warehouses.length
            ? <p style={{ color:W.textDim, fontSize:13 }}>No warehouse data.</p>
            : (
              <ResponsiveContainer width="100%" height={Math.max(220, warehouses.length * 46)}>
                <BarChart layout="vertical" data={warehouses}
                  margin={{ top:4, right:56, left:0, bottom:4 }}>
                  <CartesianGrid stroke={W.gridLine} horizontal={false} />
                  <XAxis type="number" {...xStyle({})} tickFormatter={fmt} />
                  <YAxis type="category" dataKey="warehouse_name" width={130}
                    tick={<SmartYTick />} axisLine={false} tickLine={false} />
                  <Tooltip content={<WhiteTooltip />} cursor={{ fill:"#f8fafc" }} />
                  <Bar dataKey="estimated_value" name="Value" radius={[0,6,6,0]} barSize={18}
                    label={{ position:"right", fill:W.textSec, fontSize:10, formatter:fmt }}>
                    {warehouses.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </Card>
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
   VARIANCE TAB
═══════════════════════════════════════════════════════════════════════════ */
function VarianceTab({ companyId }) {
  const now = new Date();
  const [year,setYear]   = useState(now.getFullYear());
  const [month,setMonth] = useState(now.getMonth()+1);
  const [data,setData]   = useState(null);
  const [loading,setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    analyticsApi.getBudgetVsActual(companyId,year,month).then(setData).catch(console.error).finally(()=>setLoading(false));
  }, [companyId,year,month]);

  useEffect(() => {
    let ig=false; Promise.resolve().then(()=>{if(!ig)setLoading(true);});
    analyticsApi.getBudgetVsActual(companyId,year,month).then(r=>{if(!ig)setData(r)}).catch(console.error).finally(()=>{if(!ig)setLoading(false);});
    return()=>{ig=true};
  }, [companyId,year,month]);

  return (
    <div className="aw-fade" style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <div style={{ display:"flex", gap:10, alignItems:"flex-end", flexWrap:"wrap" }}>
        <div>
          <p style={{ fontSize:11, fontWeight:700, color:W.textSec, textTransform:"uppercase", letterSpacing:".1em", marginBottom:6 }}>Month</p>
          <select value={month} onChange={e=>setMonth(+e.target.value)} className="aw-inp">
            {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
          </select>
        </div>
        <div>
          <p style={{ fontSize:11, fontWeight:700, color:W.textSec, textTransform:"uppercase", letterSpacing:".1em", marginBottom:6 }}>Year</p>
          <input type="number" value={year} onChange={e=>setYear(+e.target.value)} className="aw-inp" style={{ width:90 }} />
        </div>
        <button onClick={load} className="aw-btn-primary">Load</button>
      </div>

      {loading && <Spinner />}

      {!loading && data && (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
            <KpiCard icon="🎯" label="Total Budget" value={`PKR ${fmt(data.summary?.total_budget)}`}   color={W.accent} />
            <KpiCard icon="📊" label="Total Actual" value={`PKR ${fmt(data.summary?.total_actual)}`}   color={W.textPri} />
            <KpiCard icon="📉" label="Variance"     value={`PKR ${fmt(data.summary?.total_variance)}`}
              growth={data.summary?.total_variance_pct}
              color={data.summary?.total_variance>=0?W.green:W.red} />
          </div>

          {data.items?.length > 0 && (
            <>
              {/* Radar */}
              <Card title="360° Financial Performance Radar">
                <ResponsiveContainer width="100%" height={380}>
                  <RadarChart cx="50%" cy="50%" outerRadius="72%" data={data.items}>
                    <PolarGrid stroke={W.border} />
                    <PolarAngleAxis dataKey="account_name"
                      tick={({ x, y, payload, cx }) => {
                        const anchor = x < cx ? "end" : x > cx ? "start" : "middle";
                        return (
                          <g>
                            <title>{payload.value}</title>
                            <text x={x} y={y} textAnchor={anchor} fill={W.textSec} fontSize={10} fontWeight={500}>
                              {trunc(payload.value, 12)}
                            </text>
                          </g>
                        );
                      }}
                    />
                    <PolarRadiusAxis angle={30} domain={[0,"auto"]} tick={{ fill:W.textDim, fontSize:9 }} axisLine={false} tickLine={false} />
                    <Radar name="Budget" dataKey="budget_amount" stroke={W.border} strokeWidth={1.5} fill={W.border} fillOpacity={0.2} />
                    <Radar name="Actual" dataKey="actual_amount" stroke={W.accent} strokeWidth={2.5} fill={W.accent} fillOpacity={0.15} />
                    <Tooltip contentStyle={{ background:"#fff", border:`1px solid ${W.border}`, borderRadius:10, boxShadow:"0 8px 24px rgba(0,0,0,0.08)" }} formatter={v=>fmt(v)} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize:11, paddingTop:16 }} />
                  </RadarChart>
                </ResponsiveContainer>
                <p style={{ fontSize:11, color:W.textDim, textAlign:"center", marginTop:8 }}>
                  Area outside the gray ring indicates budget overrun
                </p>
              </Card>
            </>
          )}

          <Card title="Variance Detail">
            <DataTable
              headers={[
                { label:"Account" }, { label:"Budget", right:true },
                { label:"Actual", right:true }, { label:"Variance", right:true },
                { label:"%", right:true }, { label:"Status", right:true },
              ]}
              rows={(data.items||[]).map(row => [
                { node: <span style={{ fontWeight:600, color:W.textPri }}>{row.account_name||row.sector_id}</span> },
                { node: <span style={{ fontFamily:"monospace", color:W.textSec }}>{fmt(row.budget_amount)}</span>, style:{textAlign:"right"} },
                { node: <span style={{ fontFamily:"monospace" }}>{fmt(row.actual_amount)}</span>, style:{textAlign:"right"} },
                { node: <span style={{ fontFamily:"monospace", fontWeight:700, color:row.variance>=0?W.green:W.red }}>{fmt(row.variance)}</span>, style:{textAlign:"right"} },
                { node: <Badge val={row.variance_pct} />, style:{textAlign:"right"} },
                {
                  node: (
                    <span style={{
                      padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700,
                      background: row.status==="favorable" ? W.greenBg : W.redBg,
                      color: row.status==="favorable" ? W.green : W.red,
                    }}>
                      {row.status}
                    </span>
                  ),
                  style:{ textAlign:"right" },
                },
              ])}
            />
          </Card>
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
    <div style={{
      minHeight: "100vh",
      background: W.bg,
      padding: "32px 28px 72px",
      fontFamily: "var(--font-sans, -apple-system, BlinkMacSystemFont, sans-serif)",
    }}>
      {/* Header */}
      <div style={{ marginBottom:28, display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:16 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:W.textPri, letterSpacing:"-.02em", margin:0 }}>
            Analytics & Planning
          </h1>
          <p style={{ fontSize:13, color:W.textSec, marginTop:4 }}>
            Overview of your financial performance
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:24, overflowX:"auto", paddingBottom:4 }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`aw-tab${activeTab === tab.id ? " active" : ""}`}>
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