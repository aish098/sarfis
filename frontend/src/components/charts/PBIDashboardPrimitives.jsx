import { motion as Motion } from "framer-motion";
import { PBI } from "./chartEngine";
import { pbiFadeUp } from "./pbiAnimations";

/** Power BI visual container */
export function PowerBICard({ title, subtitle, children, className = "", action, accent }) {
  return (
    <Motion.div
      variants={pbiFadeUp}
      className={`bg-white rounded-lg border border-[#edebe9] shadow-[0_1.6px_3.6px_rgba(0,0,0,.06),0_0.3px_0.9px_rgba(0,0,0,.04)] overflow-hidden ${className}`}
      style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-0">
          <div className="min-w-0">
            {title && <h3 className="text-[13px] font-semibold text-[#252423] leading-tight">{title}</h3>}
            {subtitle && <p className="text-[11px] text-[#605e5c] mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={title || action ? "p-5 pt-3" : "p-5"}>{children}</div>
    </Motion.div>
  );
}

/** Power BI KPI callout card */
export function PowerBIKpi({ label, value, sub, icon: Icon, accent = PBI.revenue, loading }) {
  return (
    <Motion.div
      variants={pbiFadeUp}
      whileHover={{ boxShadow: "0 6.4px 14.4px rgba(0,0,0,.08)" }}
      className="bg-white rounded-lg border border-[#edebe9] p-5 shadow-[0_1.6px_3.6px_rgba(0,0,0,.06)] transition-shadow"
      style={{ borderTop: `3px solid ${accent}` }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#605e5c]">{label}</p>
        {Icon && (
          <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${accent}18` }}>
            <Icon size={15} style={{ color: accent }} />
          </div>
        )}
      </div>
      <p className="text-[26px] font-bold text-[#252423] leading-none tracking-tight font-mono mb-2">
        {loading ? "…" : value}
      </p>
      {sub && <p className="text-[11px] font-medium text-[#8a8886]">{sub}</p>}
    </Motion.div>
  );
}

/** Dashboard page header strip */
export function PowerBIHeader({ title, subtitle, meta }) {
  return (
    <div className="mb-1">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-[20px] font-semibold text-[#252423]">{title}</h1>
          {subtitle && <p className="text-[12px] text-[#605e5c] mt-0.5">{subtitle}</p>}
        </div>
        {meta && (
          <span className="inline-flex items-center self-start sm:self-auto px-3 py-1 rounded text-[10px] font-semibold uppercase tracking-wider text-[#605e5c] bg-[#f3f2f1] border border-[#edebe9]">
            {meta}
          </span>
        )}
      </div>
    </div>
  );
}
