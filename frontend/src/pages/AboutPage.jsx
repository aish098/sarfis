import { motion as Motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Target, Eye, Zap, BarChart3, Library, BrainCircuit, CheckCircle2,
  BookOpen, Sliders, Wallet, TrendingUp, Package, ShieldCheck, Briefcase
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const stats = [
  { value: '500+', label: 'Businesses Served' },
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '100%', label: 'IFRS/GAAP Compliant' },
  { value: '24/7', label: 'Support Coverage' },
];

const capabilities = [
  { icon: BookOpen, title: 'General Ledger & Core Accounting', desc: 'Double-entry journal postings, closing cycles, and opening balance migrations with strict audit trails.', color: '#06b6d4' },
  { icon: Sliders, title: 'Accounts Payable & Receivable', desc: 'Supplier matching, customer invoicing, settlement vouchers, and real-time aging summaries.', color: '#10b981' },
  { icon: Wallet, title: 'Budgeting & Control Thresholds', desc: 'Allocate department budgets, toggle blocking/warning control levels, and track variances.', color: '#f59e0b' },
  { icon: TrendingUp, title: 'Fixed Assets & Depreciation', desc: 'Category Registers for IT equipment and buildings with automated Straight-Line schedules.', color: '#8b5cf6' },
  { icon: Package, title: 'Inventory & Warehousing', desc: 'Real-time quantities, requisitions, GRNs, delivery matching, and warehouse logs.', color: '#3b82f6' },
  { icon: ShieldCheck, title: 'Credit Risk Analytics', desc: 'Entity watchlists, risk scoring, cash-only blocks, and compliance registers.', color: '#ef4444' },
  { icon: Briefcase, title: 'Integrated Payroll Engine', desc: 'Manage employees, define custom salary calculations, and post direct payslip journals.', color: '#ec4899' },
  { icon: BarChart3, title: 'Business Intelligence Analytics', desc: 'Executive dashboarding including Period Combo trends, Waterfall change bridges, and custom accents.', color: '#06b6d4' },
];

const whyPoints = [
  'Secure cloud infrastructure & multi-tenant isolation',
  'Strict IFRS/GAAP double-entry compliance',
  'Scalable SaaS platform with flexible pricing',
  'Actionable, real-time advanced analytics & alerting',
];



const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

export default function AboutPage() {
  return (
    <Motion.div
      className="relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      style={{ background: '#030b1a', minHeight: '100vh' }}
    >
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-20 px-5 sm:px-8 relative overflow-hidden" style={{ background: '#030b1a' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '52px 52px' }} />
          <Motion.div animate={{ scale: [1, 1.18, 1], opacity: [0.1, 0.18, 0.1] }} transition={{ duration: 10, repeat: Infinity }} className="absolute -top-32 right-0 w-[600px] h-[600px] rounded-full" style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 70%)', filter: 'blur(80px)', transform: 'translate(30%, 0)' }} />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)' }} />

        <div className="max-w-7xl mx-auto relative z-10 flex flex-col lg:flex-row items-center gap-16">
          <Motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            className="lg:w-1/2"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold mb-7"
              style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.25)', color: '#6ee7b7' }}>
              Our Story
            </div>
            <h1
              className="text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight mb-6"
              style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}
            >
              Powering the Future of{' '}
              <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>
                Smart Accounting
              </span>
            </h1>
            <p className="text-lg text-slate-400 mb-9 leading-relaxed">
              Cloud-based automation and financial intelligence designed to scale with your business.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                <Link to="/register" className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-white rounded-xl relative overflow-hidden group" style={{ background: 'linear-gradient(135deg, #059669, #0891b2)' }}>
                  <span className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
                  Get Started Free
                </Link>
              </Motion.div>
              <Motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                <Link to="/contact" className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-medium text-white rounded-xl border transition-all hover:bg-white/[0.05]" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}>
                  Talk to Us
                </Link>
              </Motion.div>
            </div>
          </Motion.div>

          <Motion.div
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.2 }}
            className="lg:w-1/2 relative"
          >
            <div className="absolute -inset-6 rounded-3xl opacity-20" style={{ background: 'radial-gradient(ellipse, #10b981 0%, transparent 70%)', filter: 'blur(30px)' }} />
            <img
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800"
              alt="Dashboard"
              className="relative rounded-2xl border w-full object-cover"
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}
            />
          </Motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-14 px-5 sm:px-8 border-y" style={{ background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.05)' }}>
        <Motion.div
          variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center"
        >
          {stats.map((s, i) => (
            <Motion.div key={i} variants={item}>
              <div className="text-4xl font-black text-emerald-400 mb-1" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>{s.value}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{s.label}</div>
            </Motion.div>
          ))}
        </Motion.div>
      </section>

      {/* Who we are */}
      <section className="py-24 px-5 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
          <Motion.div initial={{ opacity: 0, x: -32 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="lg:w-1/2">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold mb-6" style={{ background: 'rgba(16,185,129,0.07)', borderColor: 'rgba(16,185,129,0.2)', color: '#6ee7b7' }}>Who We Are</div>
            <h2 className="text-4xl font-black text-white tracking-tight mb-5 leading-tight" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Redefining Financial Operations for the Modern Era</h2>
            <p className="text-slate-400 text-[15px] leading-relaxed mb-4">
              SAFRS is a premium SaaS platform built to automate the entire accounting cycle while delivering deep financial insights. We bridge the gap between rigorous accounting standards and cutting-edge predictive analytics.
            </p>
            <p className="text-slate-500 text-[14px] leading-relaxed">
              Founded by a team of financial experts and AI engineers, SAFRS is trusted by hundreds of companies globally to handle mission-critical accounting operations with precision and transparency.
            </p>
          </Motion.div>
          <Motion.div initial={{ opacity: 0, x: 32 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.1 }} className="lg:w-1/2 relative group">
            <div className="absolute -inset-3 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(6,182,212,0.04))', transform: 'rotate(2deg)' }} />
            <img src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800" alt="Analytics" className="relative rounded-2xl border w-full object-cover" style={{ borderColor: 'rgba(255,255,255,0.07)' }} />
          </Motion.div>
        </div>
      </section>

      {/* Mission / Vision */}
      <section className="py-20 px-5 sm:px-8" style={{ background: 'rgba(255,255,255,0.012)' }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
          {[
            { icon: Target, title: 'Our Mission', text: 'To fully automate accounting workflows and eliminate manual data entry, enabling finance teams to focus on strategy rather than spreadsheets.', color: '#10b981', bg: '#030b1a' },
            { icon: Eye, title: 'Our Vision', text: 'To be the global intelligence layer for business finance, providing unparalleled predictive insights and securing financial resilience for every enterprise.', color: '#06b6d4', bg: '#040f1f' },
          ].map((card, i) => (
            <Motion.div key={i} initial={{ opacity: 0, x: i === 0 ? -24 : 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: i * 0.1 }}
              className="p-10 rounded-2xl border" style={{ background: card.bg, borderColor: `${card.color}25` }}>
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-6" style={{ background: `${card.color}14` }}>
                <card.icon size={28} style={{ color: card.color }} />
              </div>
              <h3 className="text-2xl font-black text-white mb-4" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>{card.title}</h3>
              <p className="text-slate-400 leading-relaxed">{card.text}</p>
            </Motion.div>
          ))}
        </div>
      </section>

      {/* Core Capabilities */}
      <section className="py-24 px-5 sm:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <Motion.h2 initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-4xl font-black text-white tracking-tight mb-4" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Core Capabilities</Motion.h2>
          <Motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="text-slate-400 text-lg">A powerful suite designed for accuracy and scale.</Motion.p>
        </div>
        <Motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="max-w-5xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {capabilities.map((cap, i) => (
            <Motion.div key={i} variants={item} whileHover={{ y: -5 }}
              className="group p-7 rounded-2xl border text-center transition-all duration-300"
              style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="w-13 h-13 rounded-xl flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform" style={{ background: `${cap.color}12`, width: 52, height: 52 }}>
                <cap.icon size={24} style={{ color: cap.color }} />
              </div>
              <h4 className="text-[15px] font-bold text-white mb-2" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>{cap.title}</h4>
              <p className="text-slate-500 text-xs leading-relaxed">{cap.desc}</p>
            </Motion.div>
          ))}
        </Motion.div>
      </section>

      {/* Why Choose */}
      <section className="py-24 px-5 sm:px-8 relative overflow-hidden" style={{ background: '#040e1f' }}>
        <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.2), transparent)' }} />
        <div className="absolute top-10 right-10 w-80 h-80 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)', filter: 'blur(60px)' }} />

        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row items-center gap-16">
          <Motion.div initial={{ opacity: 0, x: -28 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="lg:w-1/2">
            <h2 className="text-4xl font-black text-white tracking-tight leading-tight mb-9" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Why Industry Leaders Choose SAFRS</h2>
            <ul className="space-y-5">
              {whyPoints.map((point, i) => (
                <Motion.li key={i} initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.09 }} className="flex items-start gap-3.5">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(16,185,129,0.15)' }}>
                    <CheckCircle2 size={14} className="text-emerald-400" />
                  </div>
                  <span className="text-slate-300 text-[15px]">{point}</span>
                </Motion.li>
              ))}
            </ul>
          </Motion.div>

          <Motion.div initial={{ opacity: 0, scale: 0.92 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.65 }} className="lg:w-1/2">
            <div className="p-8 rounded-2xl border space-y-6" style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}>
              {[
                { label: 'Data Accuracy', value: '100%', pct: 100, color: '#10b981' },
                { label: 'Customer Satisfaction', value: '98%', pct: 98, color: '#06b6d4' },
                { label: 'Report Speed Gain', value: '10x Faster', pct: 90, color: '#8b5cf6' },
              ].map((stat, i) => (
                <div key={i}>
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-300 text-sm font-medium">{stat.label}</span>
                    <span className="text-sm font-bold" style={{ color: stat.color }}>{stat.value}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                    <Motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${stat.pct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: i * 0.15, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${stat.color}, ${stat.color}99)` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Motion.div>
        </div>
      </section>



      {/* Final CTA */}
      <section className="py-24 px-5 sm:px-8 text-center relative overflow-hidden" style={{ background: '#040e1f' }}>
        <div className="absolute inset-0 pointer-events-none">
          <Motion.div animate={{ scale: [1, 1.12, 1], opacity: [0.12, 0.2, 0.12] }} transition={{ duration: 8, repeat: Infinity }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full" style={{ background: 'radial-gradient(ellipse, #10b981 0%, transparent 70%)', filter: 'blur(60px)' }} />
        </div>
        <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.3), transparent)' }} />
        <Motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.65 }} className="relative z-10 max-w-2xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-5 leading-tight" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Start your smart accounting journey today</h2>
          <p className="text-slate-400 text-lg mb-10">Join hundreds of businesses that trust SAFRS to automate accounting and deliver real financial intelligence.</p>
          <Motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} className="inline-block">
            <Link to="/register" className="inline-flex items-center gap-2.5 px-10 py-4 text-base font-semibold text-white rounded-2xl relative overflow-hidden group" style={{ background: 'linear-gradient(135deg, #059669, #0891b2)' }}>
              <span className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />
              Get Started Free
              <Zap size={15} className="fill-white relative z-10" />
            </Link>
          </Motion.div>
        </Motion.div>
      </section>

      <Footer />
    </Motion.div>
  );
}


