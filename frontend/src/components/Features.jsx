import { motion } from 'framer-motion';
import { 
  BookOpen, BarChart3, BrainCircuit, Wallet, 
  Database, Briefcase, Activity, ShieldCheck, 
  Package, TrendingUp, Sliders, Settings 
} from 'lucide-react';

const modules = [
  {
    icon: BookOpen,
    title: 'General Ledger & Core Accounting',
    tagline: 'IFRS/GAAP Compliant Double-Entry Ledger',
    desc: 'Automate journal postings, verify ledger balances, and perform complete opening balance migrations (beginning balances) with strict audit logging.',
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.18)',
  },
  {
    icon: Sliders,
    title: 'Accounts Payable & Receivable',
    tagline: 'AP/AR Billing & Settlement Vouchers',
    desc: 'Match supplier invoices, manage client billing schedules, track payment status, and review automated accounts aging reports in real time.',
    color: '#10b981',
    glow: 'rgba(16,185,129,0.18)',
  },
  {
    icon: Wallet,
    title: 'Budgeting & Control Thresholds',
    tagline: 'Prevent Over-spending Automatically',
    desc: 'Set department budgets and activate strict warn/block control levels. Instantly analyze variances with Period-over-Period trend analysis.',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.18)',
  },
  {
    icon: TrendingUp,
    title: 'Fixed Assets & Depreciation',
    tagline: 'Automate Asset Valuation Cycles',
    desc: 'Track IT, equipment, and building assets. Automate monthly depreciation calculations (Straight-Line & Declining) mapped directly to your ledger.',
    color: '#8b5cf6',
    glow: 'rgba(139,92,246,0.18)',
  },
  {
    icon: Package,
    title: 'Inventory & Warehouse Logistics',
    tagline: 'Multi-Location Stock Controls',
    desc: 'Track live stock quantities, purchase requisitions, goods receipts, deliveries, and warehouse status logs across your entire supply chain.',
    color: '#3b82f6',
    glow: 'rgba(59,130,246,0.18)',
  },
  {
    icon: ShieldCheck,
    title: 'Credit Risk Analytics',
    tagline: 'Entity Compliance & Relationship Checks',
    desc: 'Monitor vendor and customer credit scores. flag entities under Active, Watchlist, or Blacklisted status, and automatically enforce cash-only restrictions.',
    color: '#ef4444',
    glow: 'rgba(239,68,68,0.18)',
  },
  {
    icon: Briefcase,
    title: 'Integrated Payroll Engine',
    tagline: 'Auto-Generate Compliance Payslips',
    desc: 'Calculate payroll components, configure custom salary rules, manage employee details, and generate ledger-ready journal entries automatically.',
    color: '#ec4899',
    glow: 'rgba(236,72,153,0.18)',
  },
  {
    icon: BarChart3,
    title: 'Business Intelligence Analytics',
    tagline: 'Executive Power BI Dashboarding',
    desc: 'Analyze financial health with interactive waterfall bridges, period combo analytics, and donut indicators tailored to your company accent color.',
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.18)',
  },
];

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

export default function Features() {
  return (
    <section id="features" className="py-28 px-5 sm:px-8 relative overflow-hidden" style={{ background: '#030b1a' }}>
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[300px] rounded-full" style={{ background: 'radial-gradient(ellipse, rgba(16,185,129,0.03) 0%, transparent 70%)', filter: 'blur(80px)' }} />
      </div>

      {/* Section header */}
      <div className="text-center mb-20 max-w-3xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold mb-6 uppercase tracking-wider"
          style={{
            background: 'rgba(16,185,129,0.07)',
            borderColor: 'rgba(16,185,129,0.22)',
            color: '#6ee7b7',
          }}
        >
          SaaS Enterprise Architecture
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55, delay: 0.05 }}
          className="text-4xl sm:text-5xl font-black text-white mb-5 tracking-tight leading-tight"
          style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}
        >
          Fully Integrated Modules Built for Modern Finance
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-slate-400 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto"
        >
          Skip the hassle of disconnected systems. ACCOUNTELLENCE unifies your workflows into one comprehensive ERP platform with strict referential integrity.
        </motion.p>
      </div>

      {/* Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
        className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-7xl mx-auto relative z-10"
      >
        {modules.map((m, i) => (
          <ModuleCard key={i} module={m} />
        ))}
      </motion.div>
    </section>
  );
}

function ModuleCard({ module }) {
  const Icon = module.icon;

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 22 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
      }}
      whileHover={{ y: -5, transition: { duration: 0.2, ease: 'easeOut' } }}
      className="group relative p-6 rounded-2xl border cursor-default transition-all duration-300 flex flex-col justify-between"
      style={{
        background: 'rgba(255,255,255,0.02)',
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      <div>
        {/* Hover glow border */}
        <div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${module.glow}, transparent 75%)`,
            boxShadow: `0 0 0 1px ${module.color}35`,
          }}
        />

        {/* Icon container */}
        <motion.div
          whileHover={{ scale: 1.08, rotate: 3 }}
          transition={{ type: 'spring', stiffness: 450, damping: 12 }}
          className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 relative"
          style={{ background: `${module.color}12` }}
        >
          <Icon size={20} style={{ color: module.color }} />
        </motion.div>

        <h3
          className="text-[16px] font-extrabold text-white mb-1.5 leading-snug"
          style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}
        >
          {module.title}
        </h3>
        
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-3">
          {module.tagline}
        </div>

        <p className="text-slate-400 text-[12.5px] leading-relaxed mb-4">{module.desc}</p>
      </div>

      {/* Bottom accent line */}
      <div
        className="absolute bottom-0 left-6 right-6 h-[1.5px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, transparent, ${module.color}50, transparent)` }}
      />
    </motion.div>
  );
}
