import { motion } from 'framer-motion';
import { CheckCircle2, Zap, TrendingUp, Shield, Activity } from 'lucide-react';

const metrics = [
  { label: 'Forecast Accuracy', value: '94%', color: '#10b981' },
  { label: 'Time Saved / Week', value: '12h', color: '#06b6d4' },
  { label: 'Setup Time', value: '< 5 min', color: '#8b5cf6' },
];

const items = [
  { icon: TrendingUp, text: 'Predict future cash flow with linear regression' },
  { icon: Shield, text: 'Automated financial health scoring' },
  { icon: Activity, text: 'Smart proactive budget variance alerts' },
];

export default function AdvancedFeatures() {
  return (
    <section
      className="py-28 px-5 sm:px-8 relative overflow-hidden"
      style={{ background: '#030b1a' }}
    >
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.2), transparent)' }} />

      {/* Background glow */}
      <div
        className="absolute top-1/2 left-0 w-[500px] h-[500px] rounded-full pointer-events-none -translate-y-1/2 opacity-10"
        style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 70%)', filter: 'blur(80px)' }}
      />

      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-20">
        {/* Left – image mockup */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          className="lg:w-1/2 w-full relative"
        >
          {/* Glow */}
          <div
            className="absolute -inset-6 rounded-3xl opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse, #10b981 0%, transparent 70%)', filter: 'blur(30px)' }}
          />

          {/* Main card */}
          <div
            className="relative rounded-2xl border overflow-hidden"
            style={{ background: 'linear-gradient(160deg, #0d1f14 0%, #061820 100%)', borderColor: 'rgba(16,185,129,0.15)' }}
          >
            <div
              className="flex items-center gap-2 px-5 py-3 border-b"
              style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}
            >
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400/40" />
              </div>
              <span className="text-xs text-slate-600 ml-2 font-mono">AI Forecasting Engine</span>
            </div>

            <div className="p-6">
              {/* Chart bars */}
              <div className="flex items-end gap-1.5 h-28 mb-5">
                {[55, 42, 70, 48, 85, 62, 90, 75, 95, 80].map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    whileInView={{ height: `${h}%` }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.05, duration: 0.45, ease: 'easeOut' }}
                    className="flex-1 rounded-t-sm"
                    style={{
                      background: i >= 7
                        ? 'linear-gradient(180deg, #10b981, #059669)'
                        : `rgba(16,185,129,${0.12 + (h / 100) * 0.28})`,
                    }}
                  />
                ))}
              </div>

              {/* AI badge */}
              <div className="flex items-center gap-3 p-3 rounded-xl mb-4"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(16,185,129,0.15)' }}>
                  <Zap size={15} className="text-emerald-400 fill-emerald-400" />
                </div>
                <div>
                  <div className="text-white text-xs font-semibold">AI Engine Active</div>
                  <div className="text-emerald-400 text-[10px]">Forecast confidence: 94%</div>
                </div>
                <div className="ml-auto">
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-2 h-2 rounded-full bg-emerald-400"
                  />
                </div>
              </div>

              {/* Metric chips */}
              <div className="grid grid-cols-3 gap-3">
                {metrics.map((m, i) => (
                  <div key={i} className="p-3 rounded-xl text-center"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="text-xl font-black mb-0.5" style={{ color: m.color, fontFamily: "'Sora', monospace" }}>{m.value}</div>
                    <div className="text-[10px] text-slate-500">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Floating corner badge */}
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -bottom-4 -right-4 px-4 py-2.5 rounded-xl border hidden lg:block"
            style={{
              background: 'rgba(3,11,26,0.92)',
              borderColor: 'rgba(139,92,246,0.3)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            <div className="text-white text-sm font-bold">94% Accuracy</div>
            <div className="text-slate-500 text-[11px]">Revenue prediction</div>
          </motion.div>
        </motion.div>

        {/* Right – copy */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.75, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="lg:w-1/2 w-full"
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold mb-6"
            style={{ background: 'rgba(139,92,246,0.08)', borderColor: 'rgba(139,92,246,0.25)', color: '#c4b5fd' }}
          >
            <Zap size={12} className="fill-violet-300" />
            Powered by Machine Learning
          </div>

          <h2
            className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-5 leading-tight"
            style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}
          >
            Advanced AI Features
          </h2>
          <p className="text-slate-400 text-lg mb-10 leading-relaxed">
            Leverage Python microservices to run predictive models on your ledger data. Move beyond
            historical reporting into intelligent forecasting.
          </p>

          <ul className="space-y-5 mb-10">
            {items.map((item, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.45 }}
                className="flex items-start gap-3.5"
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(16,185,129,0.12)' }}>
                  <item.icon size={15} className="text-emerald-400" />
                </div>
                <span className="text-slate-300 text-[15px] font-medium">{item.text}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
}
