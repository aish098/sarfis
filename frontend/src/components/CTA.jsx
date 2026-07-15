import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar } from 'lucide-react';

export default function CTA() {
  return (
    <section
      className="py-32 px-5 sm:px-8 relative overflow-hidden text-center"
      style={{ background: '#030b1a' }}
    >
      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)',
            backgroundSize: '52px 52px',
          }}
        />
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.12, 0.2, 0.12] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, #10b981 0%, transparent 70%)', filter: 'blur(60px)' }}
        />
      </div>
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.35), transparent)' }} />

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 max-w-3xl mx-auto"
      >
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold mb-8"
          style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.25)', color: '#6ee7b7' }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            style={{ animation: 'pulse 2s infinite' }}
          />
          No credit card required
        </div>

        <h2
          className="text-5xl sm:text-6xl md:text-7xl font-black text-white tracking-tight leading-[1.06] mb-6"
          style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}
        >
          Start Managing Your
          <br />
          <span
            className="text-transparent bg-clip-text"
            style={{ backgroundImage: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)' }}
          >
            Business Smarter
          </span>
        </h2>

        <p className="text-xl text-slate-400 mb-12 max-w-xl mx-auto leading-relaxed">
          Join hundreds of businesses that trust ACCOUNTELLENCE to automate their accounting and financial intelligence.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
            <Link
              to="/register"
              className="group inline-flex items-center gap-2.5 px-8 py-4 text-base font-semibold text-white rounded-2xl relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #059669 0%, #0891b2 100%)' }}
            >
              <span className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />
              <span
                className="absolute -inset-1 opacity-0 group-hover:opacity-50 transition-opacity duration-500 blur-xl"
                style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}
              />
              Get Started for Free
              <ArrowRight size={17} className="relative z-10 group-hover:translate-x-0.5 transition-transform duration-200" />
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2.5 px-8 py-4 text-base font-medium text-white rounded-2xl border transition-all duration-300 hover:bg-white/[0.05]"
              style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}
            >
              <Calendar size={16} />
              Book a Demo
            </Link>
          </motion.div>
        </div>

        {/* Trust logos */}
        <div className="flex flex-col items-center gap-4">
          <p className="text-xs text-slate-600 uppercase tracking-widest font-semibold">Trusted by finance teams at</p>
          <div className="flex flex-wrap justify-center gap-8">
            {['Accenture', 'Deloitte', 'KPMG', 'PwC', 'EY'].map((name) => (
              <span key={name} className="text-[13px] font-bold text-slate-700 tracking-wide">{name}</span>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
