import { motion } from 'framer-motion';
import { FilePlus, BarChart2, BrainCircuit } from 'lucide-react';

const steps = [
  {
    num: '01',
    icon: FilePlus,
    title: 'Add Transactions',
    desc: 'Easily input journal entries with our intuitive multi-line interface. Real-time balance validation keeps you accurate.',
    color: '#10b981',
  },
  {
    num: '02',
    icon: BarChart2,
    title: 'Generate Reports',
    desc: 'Instantly create IFRS/GAAP compliant financial statements — P&L, balance sheet, cash flow — with a single click.',
    color: '#06b6d4',
  },
  {
    num: '03',
    icon: BrainCircuit,
    title: 'Get AI Insights',
    desc: 'Leverage our AI engine for predictive analytics, 6-month cash flow forecasting, and actionable business intelligence.',
    color: '#8b5cf6',
  },
];

export default function HowItWorks() {
  return (
    <section
      className="py-28 px-5 sm:px-8 relative overflow-hidden"
      style={{ background: '#030b1a' }}
    >
      {/* Subtle separator lines */}
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.2), transparent)' }} />
      <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.15), transparent)' }} />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold mb-6"
            style={{ background: 'rgba(6,182,212,0.07)', borderColor: 'rgba(6,182,212,0.22)', color: '#67e8f9' }}
          >
            Simple Process
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4"
            style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}
          >
            How It Works
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55, delay: 0.14 }}
            className="text-slate-400 text-lg"
          >
            A simple, three-step process to financial clarity.
          </motion.p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 relative">


          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: i * 0.13, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6 }}
              className="relative group"
            >
              <div
                className="p-8 rounded-2xl border transition-all duration-350 h-full"
                style={{
                  background: 'rgba(255,255,255,0.025)',
                  borderColor: 'rgba(255,255,255,0.07)',
                }}
              >
                {/* Hover glow */}
                <div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
                  style={{ boxShadow: `0 0 0 1px ${step.color}35, 0 8px 32px ${step.color}12` }}
                />

                {/* Step number badge */}
                <div
                  className="absolute -top-4 left-8 px-3 py-1 rounded-full border text-xs font-black"
                  style={{
                    background: '#030b1a',
                    borderColor: `${step.color}50`,
                    color: step.color,
                    fontFamily: 'monospace',
                  }}
                >
                  {step.num}
                </div>

                {/* Icon */}
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 8 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 mt-2"
                  style={{ background: `${step.color}12` }}
                >
                  <step.icon size={26} style={{ color: step.color }} />
                </motion.div>

                <h3
                  className="text-xl font-bold text-white mb-3"
                  style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}
                >
                  {step.title}
                </h3>
                <p className="text-slate-400 text-[14px] leading-relaxed">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
