import { motion } from 'framer-motion';
import { BookOpen, BarChart3, BrainCircuit, Wallet, Lock, Zap } from 'lucide-react';

const features = [
  {
    icon: BookOpen,
    title: 'Automated Accounting',
    desc: 'Automate your journal entries, ledger posting, and closing cycle to save time and eliminate manual errors.',
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.15)',
  },
  {
    icon: BarChart3,
    title: 'Financial Analytics',
    desc: 'Instantly calculate performance ratios and compare periods for deep growth analysis and decision-making.',
    color: '#10b981',
    glow: 'rgba(16,185,129,0.15)',
  },
  {
    icon: BrainCircuit,
    title: 'AI Forecasting',
    desc: 'Predict future revenue and expenses with advanced machine learning models for proactive planning.',
    color: '#8b5cf6',
    glow: 'rgba(139,92,246,0.15)',
  },
  {
    icon: Wallet,
    title: 'Budget Planning',
    desc: 'Visualize and manage cash flows with intelligent variance alerts to keep operations on track.',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.15)',
  },
  {
    icon: Lock,
    title: 'Bank-Grade Security',
    desc: 'AES-256 encryption, SOC 2 compliance, and multi-tenant isolation keep your data fully protected.',
    color: '#10b981',
    glow: 'rgba(16,185,129,0.15)',
  },
  {
    icon: Zap,
    title: 'Real-time Reporting',
    desc: 'Generate live P&L, balance sheets, and cash flow statements with one click, exportable to PDF.',
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.15)',
  },
];

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

export default function Features() {
  return (
    <section id="features" className="py-28 px-5 sm:px-8" style={{ background: '#030b1a' }}>
      {/* Section header */}
      <div className="text-center mb-20 max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold mb-6"
          style={{
            background: 'rgba(16,185,129,0.07)',
            borderColor: 'rgba(16,185,129,0.22)',
            color: '#6ee7b7',
          }}
        >
          Platform Capabilities
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, delay: 0.08 }}
          className="text-4xl sm:text-5xl font-black text-white mb-5 tracking-tight leading-tight"
          style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}
        >
          Powerful Tools for Modern Finance
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55, delay: 0.15 }}
          className="text-slate-400 text-lg leading-relaxed"
        >
          Everything you need to automate your finances and gain critical intelligence for your business.
        </motion.p>
      </div>

      {/* Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
        className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto"
      >
        {features.map((f, i) => (
          <FeatureCard key={i} feature={f} />
        ))}
      </motion.div>
    </section>
  );
}

function FeatureCard({ feature }) {
  const Icon = feature.icon;

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 28 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
      }}
      whileHover={{ y: -6, transition: { duration: 0.25, ease: 'easeOut' } }}
      className="group relative p-7 rounded-2xl border cursor-default transition-all duration-300"
      style={{
        background: 'rgba(255,255,255,0.025)',
        borderColor: 'rgba(255,255,255,0.07)',
      }}
    >
      {/* Hover glow border */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${feature.glow}, transparent 70%)`,
          boxShadow: `0 0 0 1px ${feature.color}30`,
        }}
      />

      {/* Icon */}
      <motion.div
        whileHover={{ scale: 1.1, rotate: 5 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 relative"
        style={{ background: `${feature.color}14` }}
      >
        <Icon size={22} style={{ color: feature.color }} />
      </motion.div>

      <h3
        className="text-[17px] font-bold text-white mb-3 leading-snug"
        style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}
      >
        {feature.title}
      </h3>
      <p className="text-slate-400 text-[14px] leading-relaxed">{feature.desc}</p>

      {/* Bottom accent line */}
      <div
        className="absolute bottom-0 left-7 right-7 h-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-400"
        style={{ background: `linear-gradient(90deg, transparent, ${feature.color}60, transparent)` }}
      />
    </motion.div>
  );
}
