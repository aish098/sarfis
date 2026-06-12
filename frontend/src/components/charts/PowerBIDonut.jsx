import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { fmtChart, normalizePieData, pieRadii, ChartTooltip, PBI_PALETTE } from "./chartEngine";

/** Merge duplicate category names by summing values */
function mergePieByName(data) {
  const map = new Map();
  for (const d of data) {
    const name = String(d.name ?? d.fullName ?? "").trim();
    if (!name) continue;
    map.set(name, (map.get(name) || 0) + (parseFloat(d.value) || 0));
  }
  return Array.from(map.entries()).map(([name, value]) => ({
    name,
    fullName: name,
    value,
  }));
}

/**
 * Power BI–style donut: chart left, scrollable legend right — no overlap on center label.
 */
export function PowerBIDonut({
  data = [],
  colors = PBI_PALETTE,
  centerLabel = "Total",
  centerValue,
  height = 200,
  currency = "PKR",
}) {
  const pieData = useMemo(() => normalizePieData(mergePieByName(data)), [data]);
  const total = useMemo(() => pieData.reduce((s, d) => s + (d.value || 0), 0), [pieData]);
  const radii = pieRadii(pieData.length);
  const displayCenter = centerValue ?? fmtChart(total);
  const topSlice = pieData[0];

  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 14, minHeight: height }}>
      <div style={{ flex: "0 0 50%", minWidth: 150, maxWidth: 260, position: "relative" }}>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={radii.inner}
              outerRadius={radii.outer}
              paddingAngle={pieData.length > 6 ? 2 : 3}
              dataKey="value"
              stroke="#fff"
              strokeWidth={2}
              cornerRadius={3}
              animationDuration={650}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} style={{ outline: "none" }} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0];
                const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : 0;
                return (
                  <ChartTooltip
                    active
                    payload={[{ name: p.name, value: p.value, color: p.payload?.fill }]}
                    label={p.payload?.payload?.fullName || p.name}
                    formatter={(v) => `${currency} ${fmtChart(v)} (${pct}%)`}
                  />
                );
              }}
            />
            <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" fontSize={14} fontWeight="800" fill="#0f172a">
              {displayCenter}
            </text>
            <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" fontSize={9} fontWeight="700" fill="#64748b">
              {centerLabel}
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          maxHeight: height,
          overflowY: "auto",
          paddingRight: 4,
        }}
        className="hide-scrollbar"
      >
        {topSlice && (
          <div style={{ padding: "0 0 8px", borderBottom: "1px solid #edebe9", marginBottom: 3 }}>
            <span style={{ display: "block", fontSize: 10, color: "#8a8886", fontWeight: 700 }}>
              Largest segment
            </span>
            <span style={{ display: "block", fontSize: 12, color: "#252423", fontWeight: 700, lineHeight: 1.25 }}>
              {topSlice.fullName || topSlice.name}
            </span>
          </div>
        )}
        {pieData.map((d, i) => {
          const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : 0;
          return (
            <div
              key={d.fullName || d.name}
              title={d.fullName || d.name}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "7px 0",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: colors[i % colors.length], flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "#605e5c", lineHeight: 1.3, wordBreak: "break-word" }}>
                  {d.fullName || d.name}
                </span>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#252423", fontFamily: "monospace" }}>{pct}%</span>
                <span style={{ fontSize: 10, color: "#8a8886", display: "block", fontFamily: "monospace" }}>
                  {currency} {fmtChart(d.value)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
