/**
 * chartEngine.jsx — Dynamic Power BI–style chart layout utilities
 */

/* eslint-disable react-refresh/only-export-components */
import { useMemo } from "react";
import { ResponsiveContainer } from "recharts";

export const PBI = {
  p1: "var(--brand-primary, #10b981)",
  p2: "#1e293b",
  budget: "#94a3b8",
  actual: "var(--brand-primary, #10b981)",
  positive: "#10b981",
  negative: "#f43f5e",
  accent: "var(--brand-primary, #10b981)",
  grid: "#f1f5f9",
  axis: "#94a3b8",
  label: "#0f172a",
  muted: "#64748b",
  surface: "#ffffff",
  border: "#f1f5f9",
  revenue: "var(--brand-primary, #10b981)",
  expense: "#f43f5e",
  profit: "#10b981",
};

export const PBI_PALETTE = [
  "#118DFF", "#12239E", "#107C10", "#E66C37",
  "#744EC2", "#E044A7", "#0891b2", "#E81123",
];

export function fmtChart(n, short = true) {
  if (n === undefined || n === null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (short) {
    if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (abs >= 1_000) return (n / 1_000).toFixed(1) + "K";
  }
  return Number(n).toLocaleString("en-PK", { maximumFractionDigits: 0 });
}

export function wrapLabel(str, maxChars = 14) {
  if (!str) return "";
  const s = String(str);
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars - 1) + "…";
}

export function computeChartLayout(categories = [], options = {}) {
  const {
    seriesCount = 1,
    minHeight = 260,
    maxHeight = 620,
    forceHorizontal = false,
    forceVertical = false,
    valueMagnitudes = [],
    bottomMargin: customBottomMargin,
    rotation: customRotation,
  } = options;

  const count = Math.max(categories.length, 1);
  const lengths = categories.map((c) => String(c ?? "").length);
  const maxLen = Math.max(...lengths, 4);
  const avgLen = lengths.reduce((a, b) => a + b, 0) / count;

  const useHorizontal =
    !forceVertical &&
    (forceHorizontal ||
      count > 4 ||
      maxLen > 12 ||
      (count > 3 && avgLen > 8) ||
      (seriesCount >= 2 && count > 2 && avgLen > 6));

  const maxVal = valueMagnitudes.length
    ? Math.max(...valueMagnitudes.map((v) => Math.abs(v || 0)), 1)
    : 1;
  const yAxisWidth = maxVal >= 1_000_000 ? 62 : maxVal >= 100_000 ? 58 : 52;

  if (useHorizontal) {
    const labelWidth = Math.min(260, Math.max(100, maxLen * 6.8));
    const rowH = count > 20 ? 28 : count > 12 ? 32 : 38;
    const minRequiredHeight = count * rowH + (seriesCount >= 2 ? 88 : 72);
    const dynamicMaxHeight = Math.max(maxHeight, minRequiredHeight);
    const chartHeight = Math.min(dynamicMaxHeight, Math.max(minHeight, minRequiredHeight));
    return {
      orientation: "horizontal",
      recommendedSpan: "full",
      recommendedHeight: "landscape",
      widthVariant: "full",
      count,
      chartHeight,
      yAxisWidth: labelWidth,
      leftMargin: 8,
      rightMargin: seriesCount >= 2 ? 48 : 24,
      topMargin: seriesCount >= 2 ? 52 : 16,
      bottomMargin: customBottomMargin !== undefined ? customBottomMargin : 12,
      maxBarSize: count > 20 ? 12 : count > 12 ? 16 : 22,
      tickFontSize: count > 20 ? 9 : 10,
      labelMaxChars: Math.floor(labelWidth / 6.2),
      tickInterval: 0,
      categoryGap: "18%",
      barGap: 2,
      rotation: customRotation !== undefined ? customRotation : 0,
    };
  }

  let rotation = 0;
  let bottomMargin = 36;
  let tickFontSize = 11;
  let maxBarSize = Math.max(12, Math.min(36, Math.floor(480 / Math.max(count * seriesCount, 1))));
  let categoryGap = count > 15 ? "6%" : count > 8 ? "12%" : "18%";
  let tickInterval = 0;
  const topMargin = seriesCount >= 2 ? 52 : 24;

  if (count > 20 || avgLen > 16) {
    rotation = -45;
    bottomMargin = Math.min(130, 44 + maxLen * 2.2);
    tickFontSize = 8;
    maxBarSize = Math.min(14, maxBarSize);
    tickInterval = count > 30 ? Math.max(0, Math.floor(count / 18)) : 0;
  } else if (count > 10 || avgLen > 11) {
    rotation = -35;
    bottomMargin = Math.min(110, 40 + maxLen * 1.8);
    tickFontSize = 9;
    maxBarSize = Math.min(20, maxBarSize);
  } else if (count > 5 || avgLen > 7) {
    rotation = -25;
    bottomMargin = Math.min(88, 36 + maxLen * 1.4);
    tickFontSize = 10;
  }

  const chartHeight = Math.min(
    maxHeight,
    Math.max(minHeight, 220 + bottomMargin + (count > 12 ? 30 : 0))
  );

  const labelMaxChars =
    rotation !== 0
      ? Math.max(6, Math.floor(72 / Math.max(Math.abs(rotation) / 12, 1)))
      : Math.max(8, Math.floor(640 / Math.max(count, 1) / 7));

  return {
    orientation: "vertical",
    recommendedSpan: count > 6 ? "full" : "half",
    recommendedHeight: count > 6 ? "standard" : "landscape",
    widthVariant: count <= 2 ? "compact" : count <= 5 ? "medium" : "full",
    count,
    chartHeight,
    yAxisWidth,
    leftMargin: 0,
    rightMargin: seriesCount >= 2 ? 44 : 16,
    topMargin,
    bottomMargin: customBottomMargin !== undefined ? customBottomMargin : bottomMargin,
    maxBarSize,
    tickFontSize,
    labelMaxChars,
    tickInterval,
    categoryGap,
    barGap: seriesCount > 1 ? 2 : 4,
    rotation: customRotation !== undefined ? customRotation : rotation,
  };
}

export function buildChartMargins(layout) {
  return {
    top: layout.topMargin ?? 10,
    right: layout.rightMargin ?? 16,
    left: layout.leftMargin ?? 0,
    bottom: layout.bottomMargin ?? 28,
  };
}

export const pbiGridProps = { stroke: PBI.grid, vertical: false, strokeDasharray: "0" };

export function resolveFullName(payloadValue, lookup = []) {
  const row = lookup.find(
    (r) => r.name === payloadValue || r.shortName === payloadValue || r.label === payloadValue
  );
  return row?.fullName || row?.name || row?.label || payloadValue;
}

export function formatShortMonth(str) {
  if (!str) return "";
  const s = String(str).trim();
  // Match full month or short month + 4 digit year, e.g. "August 2025" or "Aug 2025"
  const match = s.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (match) {
    const m = match[1].slice(0, 3); // "Jan", "Feb", etc.
    const y = match[2].slice(2);    // "25", "26", etc.
    return `${m} '${y}`;
  }
  return s;
}

export function DynamicXTick({ x, y, payload, layout, lookup = [] }) {
  const full = resolveFullName(payload?.value, lookup);
  const displayVal = formatShortMonth(full);
  const display = wrapLabel(displayVal, layout?.labelMaxChars ?? 12);
  const rot = layout?.rotation ?? 0;
  const fs = layout?.tickFontSize ?? 10;

  if (!rot) {
    return (
      <g transform={`translate(${x},${y})`}>
        <title>{full}</title>
        <text textAnchor="middle" x={0} y={0} dy={14} fill={PBI.axis} fontSize={fs} fontWeight={500}>{display}</text>
      </g>
    );
  }

  return (
    <g transform={`translate(${x},${y})`}>
      <title>{full}</title>
      <text transform={`rotate(${rot})`} textAnchor="end" x={0} y={0} dy={rot <= -35 ? 10 : 8} fill={PBI.axis} fontSize={fs} fontWeight={500}>{display}</text>
    </g>
  );
}

export function DynamicYCategoryTick({ x, y, payload, layout, lookup = [] }) {
  const full = resolveFullName(payload?.value, lookup);
  const display = wrapLabel(full, layout?.labelMaxChars ?? 16);
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{full}</title>
      <text x={-8} y={0} dy={4} textAnchor="end" fill={PBI.axis} fontSize={layout?.tickFontSize ?? 10} fontWeight={500}>{display}</text>
    </g>
  );
}

export function DynamicPolarTick({ x, y, payload, cx, maxChars = 11 }) {
  const anchor = x < cx ? "end" : x > cx ? "start" : "middle";
  return (
    <g>
      <title>{payload?.value}</title>
      <text x={x} y={y} textAnchor={anchor} fill={PBI.axis} fontSize={10} fontWeight={600}>{wrapLabel(payload?.value, maxChars)}</text>
    </g>
  );
}

export function ChartTooltip({ active, payload, label, formatter, fullLabel }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: PBI.surface, border: `1px solid ${PBI.border}`, borderRadius: 4, padding: "10px 14px", minWidth: 180, maxWidth: 320, boxShadow: "0 6.4px 14.4px rgba(0,0,0,.11)" }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: PBI.label, marginBottom: 8, borderBottom: "1px solid #f3f2f1", paddingBottom: 6, wordBreak: "break-word" }}>{fullLabel || label}</p>
      {payload.filter((p) => p.value != null && p.dataKey !== "offset").map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: p.color || p.fill }} />
            <span style={{ fontSize: 11, color: PBI.axis }}>{p.name}</span>
          </div>
          <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: PBI.label }}>
            {formatter ? formatter(p.value, p.name) : `PKR ${fmtChart(p.value)}`}
          </span>
        </div>
      ))}
    </div>
  );
}

const HEIGHT_VARIANTS = {
  landscape: "h-[220px] sm:h-[260px] md:h-[280px] lg:h-[320px] w-full",
  standard: "h-[260px] sm:h-[320px] md:h-[360px] lg:h-[420px] w-full",
  tall: "h-[280px] sm:h-[340px] md:h-[380px] lg:h-[460px] w-full",
};

export function AdaptiveChartFrame({ layout, children, fallbackHeight = 280, className, variant = "standard" }) {
  const isHorizontal = layout?.orientation === "horizontal";

  if (isHorizontal) {
    return (
      <ResponsiveContainer width="100%" height={layout?.chartHeight ?? fallbackHeight} minWidth={0}>
        {children}
      </ResponsiveContainer>
    );
  }

  const heightClass = HEIGHT_VARIANTS[variant] || HEIGHT_VARIANTS.standard;

  return (
    <div className={className || heightClass}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export function buildWaterfall(rows, nameKey = "account_name", valueKey = "variance") {
  let cumulative = 0;
  return rows.map((r) => {
    const v = r[valueKey] ?? 0;
    const offset = v >= 0 ? cumulative : cumulative + v;
    cumulative += v;
    const full = r[nameKey] || r.fullName || r.name || "";
    return {
      name: wrapLabel(full, 16),
      fullName: full,
      offset: Math.max(0, offset),
      amount: Math.abs(v),
      variance: v,
      fill: v >= 0 ? PBI.positive : PBI.negative,
    };
  });
}

export function useChartLayout(categories, seriesCount = 1, valueMagnitudes = []) {
  return useMemo(
    () => computeChartLayout(categories, { seriesCount, valueMagnitudes }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(categories), seriesCount, JSON.stringify(valueMagnitudes)]
  );
}

export function normalizeChartRows(rows, nameKey, layout) {
  return rows.map((row) => {
    const full = row[nameKey] ?? row.fullName ?? row.account_name ?? row.label ?? "";
    return { ...row, fullName: full, shortName: wrapLabel(full, layout?.labelMaxChars ?? 14), name: wrapLabel(full, layout?.labelMaxChars ?? 14) };
  });
}

export function normalizePieData(data, maxSlices = 8) {
  if (data.length <= maxSlices) return data;
  const sorted = [...data].sort((a, b) => (b.value || 0) - (a.value || 0));
  const top = sorted.slice(0, maxSlices - 1);
  const otherVal = sorted.slice(maxSlices - 1).reduce((s, d) => s + (d.value || 0), 0);
  if (otherVal > 0) top.push({ name: "Other", value: otherVal, fullName: "Other categories" });
  return top;
}

export function pieRadii(sliceCount) {
  if (sliceCount > 8) return { inner: "58%", outer: "82%" };
  if (sliceCount > 5) return { inner: "62%", outer: "86%" };
  return { inner: "65%", outer: "88%" };
}

export const legendStyle = { fontSize: 11, fontWeight: 600, paddingTop: 8, lineHeight: "18px" };

export function yAxisProps(layout, formatter = fmtChart) {
  return {
    tick: { fill: PBI.axis, fontSize: layout?.tickFontSize ?? 10, fontWeight: 500 },
    axisLine: false,
    tickLine: false,
    tickFormatter: formatter,
    width: layout?.yAxisWidth ?? 52,
    domain: [(dataMin) => Math.min(0, dataMin), "auto"]
  };
}

export function xAxisPropsVertical(layout) {
  return { tick: { fill: PBI.axis, fontSize: layout?.tickFontSize ?? 10, fontWeight: 500 }, axisLine: false, tickLine: false, interval: layout?.tickInterval ?? 0, height: layout?.bottomMargin ?? 28 };
}
