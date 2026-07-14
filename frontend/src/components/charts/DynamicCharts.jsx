import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ComposedChart, Line, ReferenceLine, LabelList, Cell,
} from "recharts";
import {
  PBI, fmtChart, buildChartMargins, pbiGridProps, yAxisProps,
  DynamicXTick, DynamicYCategoryTick, ChartTooltip, resolveFullName, legendStyle,
} from "./chartEngine";

const legendTop = { ...legendStyle, paddingTop: 0, paddingBottom: 8, fontSize: 10 };

/** Power BI clustered bars — auto vertical or horizontal from layout */
export function DynamicClusteredBarChart({ chartRows, layout, lookup, series }) {
  const margins = buildChartMargins(layout);
  const tip = (p) => <ChartTooltip {...p} fullLabel={resolveFullName(p.label, lookup)} />;

  if (layout.orientation === "horizontal") {
    return (
      <BarChart layout="vertical" data={chartRows} margin={margins} barGap={layout.barGap} barCategoryGap={layout.categoryGap}>
        <CartesianGrid stroke={PBI.grid} horizontal={false} vertical strokeDasharray="0" />
        <XAxis type="number" tick={{ fill: "#605e5c", fontSize: layout.tickFontSize, fontWeight: 500 }} axisLine={false} tickLine={false} tickFormatter={fmtChart} />
        <YAxis type="category" dataKey="name" width={layout.yAxisWidth} tick={(p) => <DynamicYCategoryTick {...p} layout={layout} lookup={lookup} />} axisLine={false} tickLine={false} />
        <Tooltip content={tip} cursor={{ fill: "rgba(17,141,255,0.06)" }} />
        <Legend iconType="square" iconSize={10} verticalAlign="top" align="right" wrapperStyle={legendTop} />
        {series.map((s) => (
          <Bar key={s.dataKey} dataKey={s.dataKey} name={s.name} fill={s.fill} radius={[0, 3, 3, 0]} maxBarSize={layout.maxBarSize} />
        ))}
      </BarChart>
    );
  }

  return (
    <BarChart data={chartRows} margin={margins} barGap={layout.barGap} barCategoryGap={layout.categoryGap}>
      <CartesianGrid {...pbiGridProps} />
      <XAxis dataKey="name" interval={layout.tickInterval} height={layout.bottomMargin} tick={(p) => <DynamicXTick {...p} layout={layout} lookup={lookup} />} axisLine={false} tickLine={false} />
      <YAxis {...yAxisProps(layout)} />
      <Tooltip content={tip} cursor={{ fill: "rgba(17,141,255,0.06)" }} />
      <Legend iconType="square" iconSize={10} verticalAlign="top" align="right" wrapperStyle={legendTop} />
      {series.map((s) => (
        <Bar key={s.dataKey} dataKey={s.dataKey} name={s.name} fill={s.fill} radius={[2, 2, 0, 0]} maxBarSize={layout.maxBarSize} />
      ))}
    </BarChart>
  );
}

/** Horizontal variance bars with conditional coloring */
export function DynamicVarianceBarChart({ chartRows, layout, lookup }) {
  const margins = buildChartMargins(layout);
  return (
    <BarChart layout="vertical" data={chartRows} margin={margins}>
      <CartesianGrid stroke={PBI.grid} horizontal={false} vertical strokeDasharray="0" />
      <XAxis type="number" tick={{ fill: "#605e5c", fontSize: layout.tickFontSize, fontWeight: 500 }} axisLine={false} tickLine={false} tickFormatter={fmtChart} />
      <YAxis type="category" dataKey="name" width={layout.yAxisWidth} tick={(p) => <DynamicYCategoryTick {...p} layout={layout} lookup={lookup} />} axisLine={false} tickLine={false} />
      <Tooltip content={(p) => <ChartTooltip {...p} fullLabel={resolveFullName(p.label, lookup)} formatter={(v) => `PKR ${fmtChart(v)}`} />} />
      <ReferenceLine x={0} stroke="#252423" strokeWidth={1} />
      <Bar dataKey="variance" name="Variance" radius={[0, 3, 3, 0]} maxBarSize={layout.maxBarSize}>
        {chartRows.map((entry, i) => <Cell key={i} fill={entry.variance >= 0 ? PBI.positive : PBI.negative} />)}
      </Bar>
    </BarChart>
  );
}

/** Waterfall bridge chart */
export function DynamicWaterfallChart({ waterfall, layout, lookup }) {
  const margins = buildChartMargins({ ...layout, bottomMargin: Math.max(layout.bottomMargin, 56) });
  return (
    <BarChart data={waterfall} margin={margins}>
      <CartesianGrid {...pbiGridProps} />
      <XAxis dataKey="name" interval={layout.tickInterval || 0} height={layout.bottomMargin + 16} tick={(p) => <DynamicXTick {...p} layout={layout} lookup={lookup} />} axisLine={false} tickLine={false} />
      <YAxis {...yAxisProps(layout)} />
      <Tooltip content={({ active, label }) => {
        if (!active) return null;
        const row = waterfall.find((w) => w.name === label);
        return <ChartTooltip active payload={[{ name: "Variance", value: row?.variance, color: row?.fill }]} label={row?.fullName || label} formatter={(v) => `PKR ${fmtChart(v)}`} />;
      }} />
      <Bar dataKey="offset" stackId="wf" fill="transparent" stroke="none" />
      <Bar dataKey="amount" stackId="wf" name="Variance" radius={[2, 2, 0, 0]} maxBarSize={layout.maxBarSize}>
        {waterfall.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
        <LabelList dataKey="variance" position="top" formatter={(v) => fmtChart(v)} style={{ fontSize: 9, fontWeight: 700, fill: "#605e5c" }} />
      </Bar>
      <ReferenceLine y={0} stroke="#252423" strokeWidth={1} />
    </BarChart>
  );
}

/** Combo bars + line — horizontal when layout says so (fixes label overlap) */
export function DynamicComboChart({
  chartRows,
  layout,
  lookup,
  barSeries,
  lineKey,
  lineName,
  lineFormatter,
  lineColor = "#e66c37",
}) {
  const margins = buildChartMargins(layout);
  const tip = (p) => <ChartTooltip {...p} fullLabel={resolveFullName(p.label, lookup)} formatter={lineFormatter} />;

  if (layout.orientation === "horizontal") {
    return (
      <ComposedChart layout="vertical" data={chartRows} margin={margins}>
        <CartesianGrid stroke={PBI.grid} horizontal={false} vertical strokeDasharray="0" />
        <XAxis xAxisId="amount" type="number" tick={{ fill: "#605e5c", fontSize: layout.tickFontSize, fontWeight: 500 }} axisLine={false} tickLine={false} tickFormatter={fmtChart} />
        <XAxis xAxisId="pct" type="number" orientation="top" tick={{ fill: "#605e5c", fontSize: 9, fontWeight: 500 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} height={28} />
        <YAxis type="category" dataKey="name" width={layout.yAxisWidth} tick={(p) => <DynamicYCategoryTick {...p} layout={layout} lookup={lookup} />} axisLine={false} tickLine={false} />
        <Tooltip content={tip} />
        <Legend iconType="square" iconSize={10} verticalAlign="top" align="right" wrapperStyle={legendTop} />
        {barSeries.map((s) => (
          <Bar key={s.dataKey} xAxisId="amount" dataKey={s.dataKey} name={s.name} fill={s.fill} barSize={Math.min(12, layout.maxBarSize)} radius={[0, 3, 3, 0]} />
        ))}
        <Line xAxisId="pct" type="monotone" dataKey={lineKey} name={lineName} stroke={lineColor} strokeWidth={2.5} dot={{ r: 3, fill: lineColor, strokeWidth: 0 }} />
      </ComposedChart>
    );
  }

  return (
    <ComposedChart data={chartRows} margin={margins}>
      <CartesianGrid {...pbiGridProps} />
      <XAxis dataKey="name" interval={layout.tickInterval} height={layout.bottomMargin + 8} tick={(p) => <DynamicXTick {...p} layout={layout} lookup={lookup} />} axisLine={false} tickLine={false} />
      <YAxis yAxisId="left" {...yAxisProps(layout)} />
      <YAxis yAxisId="right" orientation="right" tick={{ fill: "#605e5c", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} width={44} />
      <Tooltip content={tip} />
      <Legend verticalAlign="top" align="right" wrapperStyle={legendTop} />
      {barSeries.map((s) => (
        <Bar key={s.dataKey} yAxisId="left" dataKey={s.dataKey} name={s.name} fill={s.fill} barSize={Math.min(12, layout.maxBarSize)} radius={[2, 2, 0, 0]} />
      ))}
      <Line yAxisId="right" type="monotone" dataKey={lineKey} name={lineName} stroke={lineColor} strokeWidth={2.5} dot={{ r: 3, fill: lineColor, strokeWidth: 0 }} activeDot={{ r: 5 }} />
    </ComposedChart>
  );
}

/** Single-series vertical/horizontal bar */
export function DynamicBarSeries({ chartRows, layout, lookup, dataKey, name, fill, gradientId }) {
  const margins = buildChartMargins(layout);

  if (layout.orientation === "horizontal") {
    return (
      <BarChart layout="vertical" data={chartRows} margin={margins}>
        <CartesianGrid stroke={PBI.grid} horizontal={false} vertical strokeDasharray="0" />
        <XAxis type="number" tickFormatter={fmtChart} tick={{ fill: "#605e5c", fontSize: layout.tickFontSize }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={layout.yAxisWidth} tick={(p) => <DynamicYCategoryTick {...p} layout={layout} lookup={lookup} />} axisLine={false} tickLine={false} />
        <Tooltip content={(p) => <ChartTooltip {...p} fullLabel={resolveFullName(p.label, lookup)} />} cursor={{ fill: "rgba(17,141,255,0.05)" }} />
        <Bar dataKey={dataKey} name={name} fill={gradientId ? `url(#${gradientId})` : fill} radius={[0, 4, 4, 0]} maxBarSize={layout.maxBarSize} />
      </BarChart>
    );
  }

  return (
    <BarChart data={chartRows} margin={margins} barCategoryGap={layout.categoryGap}>
      <CartesianGrid {...pbiGridProps} />
      <XAxis dataKey="name" interval={layout.tickInterval} height={layout.bottomMargin} tick={(p) => <DynamicXTick {...p} layout={layout} lookup={lookup} />} axisLine={false} tickLine={false} />
      <YAxis {...yAxisProps(layout)} />
      <Tooltip content={(p) => <ChartTooltip {...p} fullLabel={resolveFullName(p.label, lookup)} />} cursor={{ fill: "rgba(17,141,255,0.05)" }} />
      <Bar dataKey={dataKey} name={name} fill={gradientId ? `url(#${gradientId})` : fill} radius={[4, 4, 0, 0]} maxBarSize={layout.maxBarSize}>
        {chartRows.map((d, i) => <Cell key={i} fill={d.fill || (gradientId ? `url(#${gradientId})` : fill)} />)}
      </Bar>
    </BarChart>
  );
}
