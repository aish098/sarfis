import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, TrendingUp, ShieldCheck, Cpu, BarChart3, Zap } from 'lucide-react';

const stats = [
  { value: '10K+', label: 'Daily Transactions' },
  { value: '500+', label: 'Businesses Onboarded' },
  { value: '99.9%', label: 'Uptime Guarantee' },
];

const floatingBadges = [
  { icon: TrendingUp, text: 'Revenue +24%', sub: 'vs last quarter', color: '#10b981' },
  { icon: ShieldCheck, text: 'AES-256 Encrypted', sub: 'Bank-grade security', color: '#06b6d4' },
  { icon: Cpu, text: 'AI Forecasting', sub: '94% accuracy rate', color: '#8b5cf6' },
];

const mockKPIs = [
  { label: 'Total Revenue', value: '$284,920', change: '+18.4%', positive: true },
  { label: 'Net Profit', value: '$91,340', change: '+12.1%', positive: true },
  { label: 'Expenses', value: '$193,580', change: '-3.2%', positive: false },
  { label: 'Cash Flow', value: '$47,820', change: '+9.7%', positive: true },
];

export default function Hero() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end start'] });
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const contentY = useTransform(scrollYProgress, [0, 0.6], [0, -50]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-20 pb-16"
      style={{ background: '#030b1a' }}
    >
      {/* Animated background blobs */}
      <motion.div style={{ y: bgY }} className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.14, 0.22, 0.14] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full"
          style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 70%)', filter: 'blur(80px)' }}
        />
        <motion.div
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.08, 0.16, 0.08] }}
          transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
          className="absolute -bottom-48 -right-24 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)', filter: 'blur(80px)' }}
        />
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.05, 0.1, 0.05] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 70%)', filter: 'blur(60px)' }}
        />
        {/* Grid texture */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '52px 52px',
          }}
        />
      </motion.div>

      <motion.div
        style={{ opacity: contentOpacity, y: contentY }}
        className="relative z-10 w-full max-w-6xl mx-auto px-5 sm:px-8 text-center"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-8 text-sm font-medium"
          style={{
            background: 'rgba(16, 185, 129, 0.08)',
            borderColor: 'rgba(16, 185, 129, 0.25)',
            color: '#6ee7b7',
          }}
        >
          <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 2.5, repeat: Infinity }}>
            <Sparkles size={13} />
          </motion.div>
          Trusted by 500+ businesses worldwide
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.06] mb-5"
          style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}
        >
          Smarter Accounting,
          <br />
          <span
            className="text-transparent bg-clip-text"
            style={{ backgroundImage: 'linear-gradient(135deg, #10b981 0%, #06b6d4 60%, #10b981 100%)', backgroundSize: '200% 200%' }}
          >
            Powered by SARFIS
          </span>
        </motion.h1>

        {/* Subline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.32 }}
          className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          SARFIS automates your full accounting cycle journal entries, ledger, AI analytics, and
          forecasting so your team can focus on what matters most.
        </motion.p>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.42 }}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
        >
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
            <Link
              to="/register"
              className="group inline-flex items-center gap-2.5 px-8 py-4 text-base font-semibold text-white rounded-2xl relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #059669 0%, #0891b2 100%)' }}
            >
              <span className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />
              <span
                className="absolute -inset-1 opacity-0 group-hover:opacity-40 transition-opacity duration-500 blur-xl"
                style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}
              />
              Start Free Trial
              <ArrowRight size={17} className="relative z-10 group-hover:translate-x-0.5 transition-transform duration-200" />
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
            <Link
              to="/login"
              className="inline-flex items-center gap-2.5 px-8 py-4 text-base font-medium text-white rounded-2xl border transition-all duration-300"
              style={{
                background: 'rgba(255,255,255,0.04)',
                borderColor: 'rgba(255,255,255,0.1)',
              }}
            >
              Sign In to Dashboard
            </Link>
          </motion.div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.55 }}
          className="flex flex-col sm:flex-row justify-center items-center gap-10 sm:gap-16 mb-20"
        >
          {stats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              className="text-center"
            >
              <motion.div
                whileHover={{ scale: 1.06 }}
                className="text-4xl font-black text-white mb-1 leading-none"
                style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}
              >
                {s.value}
              </motion.div>
              <div className="text-sm text-slate-500">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Floating dashboard mockup */}
        <motion.div
          initial={{ opacity: 0, y: 80, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.1, delay: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          {/* Glow behind image */}
          <div
            className="absolute -inset-8 rounded-3xl opacity-30 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse, #10b981 0%, transparent 70%)', filter: 'blur(40px)' }}
          />

          {/* Floating animation wrapper */}
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            className="relative"
          >
            {/* Browser chrome */}
            <div
              className="relative rounded-2xl overflow-hidden border"
              style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
            >
              {/* Titlebar */}
              <div
                className="flex items-center gap-3 px-5 py-3.5 border-b"
                style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400/50" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400/50" />
                  <div className="w-3 h-3 rounded-full bg-green-400/50" />
                </div>
                <div
                  className="flex-1 mx-4 bg-white/[0.05] rounded-md px-3 py-1.5 text-xs text-slate-600"
                  style={{ fontFamily: 'monospace' }}
                >
                  app.SARFIS.io/dashboard/analytics
                </div>
              </div>

              {/* Dashboard content */}
              <div className="p-6" style={{ background: 'linear-gradient(180deg, #0d1829 0%, #06101e 100%)' }}>
                {/* KPI cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  {mockKPIs.map((kpi, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.9 + i * 0.08 }}
                      className="p-4 rounded-xl border"
                      style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}
                    >
                      <div className="text-[10px] text-slate-500 mb-1.5 font-medium uppercase tracking-wider">{kpi.label}</div>
                      <div className="text-lg font-black text-white mb-1" style={{ fontFamily: "'Sora', monospace" }}>{kpi.value}</div>
                      <div className={`text-[11px] font-semibold ${kpi.positive ? 'text-emerald-400' : 'text-rose-400'}`}>{kpi.change}</div>
                    </motion.div>
                  ))}
                </div>

                {/* Chart placeholder */}
                <div
                  className="rounded-xl border p-5 flex items-end gap-1.5 h-32"
                  style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}
                >
                  {[40, 65, 45, 80, 55, 90, 70, 95, 75, 88, 60, 100].map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ delay: 1.1 + i * 0.04, duration: 0.4, ease: 'easeOut' }}
                      className="flex-1 rounded-t-sm"
                      style={{
                        background: i === 11
                          ? 'linear-gradient(180deg, #10b981, #059669)'
                          : `rgba(16,185,129,${0.15 + (h / 100) * 0.35})`,
                        minWidth: 0,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Floating badges */}
            {floatingBadges.map((badge, i) => {
              const positions = [
                'absolute -left-6 top-16 lg:-left-16',
                'absolute -right-6 top-10 lg:-right-16',
                'absolute -left-4 bottom-16 lg:-left-14',
              ];
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.3 + i * 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  className={`${positions[i]} hidden lg:flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl`}
                  style={{
                    background: 'rgba(3,11,26,0.9)',
                    borderColor: 'rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(20px)',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: `${badge.color}18` }}
                  >
                    <badge.icon size={16} style={{ color: badge.color }} />
                  </div>
                  <div>
                    <div className="text-white text-[13px] font-semibold leading-none mb-0.5">{badge.text}</div>
                    <div className="text-slate-500 text-[11px]">{badge.sub}</div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}
