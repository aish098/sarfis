import { useState } from 'react';
import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

// Avatar component supporting passport-style rectangular photos with initials fallback
function ExecutiveAvatar({ initials, src, size = "w-28 h-36", borderAccent = "border-emerald-500" }) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className={`relative flex items-center justify-center rounded-2xl bg-[#050f21] border-2 ${borderAccent} ${size} shadow-lg shadow-emerald-500/5 overflow-hidden transition-transform duration-500 hover:scale-105`}>
      {src && !imageError ? (
        <img 
          src={src} 
          alt={initials} 
          className="w-full h-full object-cover" 
          onError={() => setImageError(true)}
        />
      ) : (
        <span className="text-2xl font-bold text-white font-mono">{initials}</span>
      )}
      <div className="absolute inset-0 rounded-2xl bg-emerald-500/5 blur-sm pointer-events-none" />
    </div>
  );
}

// Scroll animation presets
const scrollVariants = {
  hidden: { opacity: 0, y: 35 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.65, ease: [0.215, 0.61, 0.355, 1] }
  }
};

// spring animation helper for card hover
const cardHoverProps = {
  whileHover: { y: -6, scale: 1.008, borderColor: "rgba(16, 185, 129, 0.3)" },
  transition: { type: "spring", stiffness: 400, damping: 24 }
};

const treeNodeHoverProps = {
  whileHover: { scale: 1.05, borderColor: "rgba(16, 185, 129, 0.4)" },
  transition: { type: "spring", stiffness: 500, damping: 15 }
};

export default function LeadershipPage() {
  // Inject custom marquee styles programmatically
  if (typeof document !== 'undefined' && !document.getElementById('lp-marquee-styles')) {
    const s = document.createElement('style');
    s.id = 'lp-marquee-styles';
    s.textContent = `
      @keyframes lpMarquee {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
      .animate-lp-marquee {
        display: flex;
        gap: 16px;
        width: max-content;
        animation: lpMarquee 30s linear infinite;
      }
      .animate-lp-marquee:hover {
        animation-play-state: paused;
      }
    `;
    document.head.appendChild(s);
  }

  const DIRECTORY_DATA = [
    { initials: "RZ", name: "Rana Muhammad Zain Ul Abideen", title: "CEO & Founder", accent: "#10b981" },
    { initials: "SM", name: "Professor Saad Anwar Mughal", title: "Taxation & Financial Governance Advisor", accent: "#06b6d4" },
    { initials: "RA", name: "Professor Muhammad Rehan Anjum", title: "Accounting & IFRS Advisor", accent: "#f59e0b" },
    { initials: "AK", name: "Ayesha Kashif", title: "Lead Developer & Co-Founder", accent: "#10b981" },
    { initials: "AA", name: "Amna Waheed Ahmed", title: "HR Executive", accent: "#a78bfa" },
    { initials: "TK", name: "Rana Talal Khan", title: "Financial Analyst", accent: "#f59e0b" },
    { initials: "SA", name: "Syed Ansar Ali", title: "DevOps Engineer", accent: "#06b6d4" },
    { initials: "FK", name: "Farhan Ahmed Khokhar", title: "Advocate High Court • Tax & Corporate Law Advisor", accent: "#10b981" }
  ];

  const doubledDirectory = [...DIRECTORY_DATA, ...DIRECTORY_DATA];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-[#030b1a] min-h-screen text-white font-sans overflow-hidden"
    >
      <Navbar />

      {/* Hero Headline Section */}
      <section className="pt-32 pb-16 px-5 sm:px-8 text-center max-w-4xl mx-auto relative z-10">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/5 text-xs font-semibold tracking-wider text-[#6ee7b7] mb-6 uppercase"
        >
          Corporate Profile
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-6xl font-black tracking-tight mb-5" 
          style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
        >
          Our{" "}
          <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Leadership
          </span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-slate-400 text-base sm:text-lg leading-relaxed max-w-xl mx-auto"
        >
          Visionaries, academics, and strategic leaders steering the next generation of financial and operational resource planning.
        </motion.p>
      </section>

      {/* SECTION 1 — CEO & FOUNDER (Hero Profile Card) */}
      <motion.section 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={scrollVariants}
        className="py-12 px-5 sm:px-8 max-w-5xl mx-auto"
      >
        <motion.div 
          whileHover={{ y: -8, scale: 1.005, borderColor: "rgba(16, 185, 129, 0.25)", boxShadow: "0 20px 40px -15px rgba(16, 185, 129, 0.05)" }}
          transition={{ type: "spring", stiffness: 450, damping: 25 }}
          className="bg-[#050f21] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-6 sm:p-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-center cursor-default"
        >
          {/* Left Side: Portrait & Metrics */}
          <div className="md:col-span-5 flex flex-col items-center text-center space-y-6 md:border-r md:border-slate-800/80 md:pr-8">
            <div className="relative p-1.5 rounded-2xl border-2 border-emerald-500/80 shadow-lg shadow-emerald-500/5">
              <ExecutiveAvatar 
                initials="RZ" 
                src="/images/leadership/zain.jpg" 
                size="w-40 h-52" 
                borderAccent="border-emerald-500" 
              />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Rana Muhammad Zain Ul Abideen</h2>
              <div className="mt-2 inline-block px-3.5 py-1.5 bg-emerald-950/40 border border-emerald-500/20 rounded-full text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                CEO & Founder
              </div>
            </div>
            
            {/* Founder Metrics */}
            <div className="grid grid-cols-3 gap-4 w-full pt-4 border-t border-slate-850">
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-black text-white font-mono">12+</div>
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Years</div>
              </div>
              <div className="text-center border-x border-slate-850">
                <div className="text-xl sm:text-2xl font-black text-white font-mono">4</div>
                <div className="text-[10px] text-slate-500 uppercase font-semibold">ERP Systems</div>
              </div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-black text-white font-mono">50+</div>
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Companies</div>
              </div>
            </div>
          </div>

          {/* Right Side: Vision content */}
          <div className="md:col-span-7 space-y-6">
            <div>
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Founder Vision</span>
              <h3 className="text-2xl sm:text-3xl font-black text-white mt-1" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Platform Steering</h3>
            </div>

            <div className="space-y-4 text-xs sm:text-sm">
              <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl transition duration-300 hover:bg-slate-950/60">
                <h4 className="font-extrabold text-white text-[12.5px] uppercase tracking-wider mb-1 text-emerald-400">Enterprise Vision</h4>
                <p className="text-slate-400 leading-relaxed text-[12px]">
                  SARFIS was designed and engineered to consolidate isolated corporate workflows into a unified, compliant, and real-time enterprise resource platform.
                </p>
              </div>

              <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl transition duration-300 hover:bg-slate-950/60">
                <h4 className="font-extrabold text-white text-[12.5px] uppercase tracking-wider mb-1 text-emerald-400">Financial Intelligence</h4>
                <p className="text-slate-400 leading-relaxed text-[12px]">
                  Focuses on executing robust accounting structures, auto-matched journal validations, and audit trails to optimize organizational governance.
                </p>
              </div>

              <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl transition duration-300 hover:bg-slate-950/60">
                <h4 className="font-extrabold text-white text-[12.5px] uppercase tracking-wider mb-1 text-emerald-400">Long-Term Mission</h4>
                <p className="text-slate-400 leading-relaxed text-[12px]">
                  Democratizing enterprise-grade financial systems and workflow automations, empowering SMEs and corporate groups with high-fidelity control structures.
                </p>
              </div>
            </div>

            <div className="border-l-2 border-emerald-500 pl-4 py-1 italic text-slate-400 text-xs sm:text-sm font-medium">
              "SARFIS is not just accounting software—it is an enterprise operating platform built for modern organizations."
            </div>
          </div>

        </motion.div>
      </motion.section>

      {/* SECTION 2 — Mentors & Academic Advisors */}
      <motion.section 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={scrollVariants}
        className="py-16 px-5 sm:px-8 max-w-5xl mx-auto border-t border-slate-900"
      >
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-black text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
            Mentors & Academic Advisors
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm max-w-xl mx-auto mt-2">
            Senior academics and industry professionals providing strategic, accounting, taxation and governance guidance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Card 1: Prof. Saad */}
          <motion.div 
            {...cardHoverProps}
            className="bg-[#050f21] border border-slate-800 rounded-3xl p-6 flex flex-col justify-between space-y-6 shadow-xl cursor-default"
          >
            <div className="space-y-4">
              <div className="flex gap-4 items-start flex-wrap sm:flex-nowrap">
                <ExecutiveAvatar 
                  initials="SM" 
                  src="/images/leadership/saad.jpg" 
                  size="w-28 h-36" 
                  borderAccent="border-emerald-500/60" 
                />
                <div className="flex-1">
                  <h3 className="text-base font-extrabold text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Professor Saad Anwar Mughal</h3>
                  <div className="mt-1">
                    <span className="inline-block px-3 py-1 bg-emerald-950/40 border border-emerald-500/20 rounded-full text-[9px] font-black text-emerald-400 uppercase tracking-widest leading-relaxed">
                      Professor • Taxation & Financial Governance Advisor
                    </span>
                  </div>
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                {["Taxation", "IFRS", "Financial Reporting", "Governance"].map(b => (
                  <span key={b} className="bg-slate-900 border border-slate-800 text-[10px] px-2 py-0.5 rounded text-slate-400 font-semibold">{b}</span>
                ))}
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Advises on taxation framework alignments, compliance audits, IFRS standards implementations, and coordinates corporate taxation governance modules within the SARFIS ERP engine.
              </p>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-850 text-xs">
              <div>
                <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Experience</span>
                <span className="text-base font-black text-white font-mono">15+ Years</span>
              </div>
              <div>
                <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Projects</span>
                <span className="text-base font-black text-white font-mono">200+ Research & Advisory</span>
              </div>
            </div>
          </motion.div>

          {/* Card 2: Prof. Rehan */}
          <motion.div 
            {...cardHoverProps}
            className="bg-[#050f21] border border-slate-800 rounded-3xl p-6 flex flex-col justify-between space-y-6 shadow-xl cursor-default"
          >
            <div className="space-y-4">
              <div className="flex gap-4 items-start flex-wrap sm:flex-nowrap">
                <ExecutiveAvatar 
                  initials="RA" 
                  src="/images/leadership/rehan.jpg" 
                  size="w-28 h-36" 
                  borderAccent="border-emerald-500/60" 
                />
                <div className="flex-1">
                  <h3 className="text-base font-extrabold text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Professor Muhammad Rehan Anjum</h3>
                  <div className="mt-1">
                    <span className="inline-block px-3 py-1 bg-emerald-950/40 border border-emerald-500/20 rounded-full text-[9px] font-black text-emerald-400 uppercase tracking-widest leading-relaxed">
                      Professor • Accounting & IFRS Advisor
                    </span>
                  </div>
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                {["Accounting", "IFRS", "Audit", "Compliance"].map(b => (
                  <span key={b} className="bg-slate-900 border border-slate-800 text-[10px] px-2 py-0.5 rounded text-slate-400 font-semibold">{b}</span>
                ))}
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Applies advanced academic and industry accounting methodology audits to verify general ledger integrations, compliant double-entry checks, and overall system financial logic.
              </p>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-850 text-xs">
              <div>
                <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Experience</span>
                <span className="text-base font-black text-white font-mono">18+ Years</span>
              </div>
              <div>
                <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Projects</span>
                <span className="text-base font-black text-white font-mono">300+ Academic & Industry</span>
              </div>
            </div>
          </motion.div>

        </div>
      </motion.section>

      {/* SECTION 3 — Strategic Management & Core Development */}
      <motion.section 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={scrollVariants}
        className="py-16 px-5 sm:px-8 max-w-5xl mx-auto border-t border-slate-900"
      >
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-black text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
            Strategic Management & Core Development Team
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Left Card: Ayesha */}
          <motion.div 
            {...cardHoverProps}
            className="bg-[#050f21] border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl cursor-default"
          >
            <div className="flex gap-4 items-start">
              <ExecutiveAvatar 
                initials="AK" 
                src="/images/leadership/ayesha.jpg" 
                size="w-28 h-36" 
                borderAccent="border-emerald-500/60" 
              />
              <div className="flex-1">
                <h3 className="text-base font-extrabold text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Ayesha Kashif</h3>
                <div className="mt-1">
                  <span className="inline-block px-3 py-1 bg-emerald-950/40 border border-emerald-500/20 rounded-full text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                    Lead Developer & Co-Founder
                  </span>
                </div>
              </div>
            </div>

            {/* Responsibilities */}
            <div className="space-y-3">
              <div>
                <span className="text-[9.5px] uppercase font-bold text-slate-500 block mb-1">Core Expertise</span>
                <div className="flex flex-wrap gap-1.5">
                  {["Enterprise ERP Architecture", "Full-Stack Software Engineering", "UI/UX & Product Experience", "Technical Strategy & Innovation", "Scalable System Design"].map(r => (
                    <span key={r} className="bg-slate-900 border border-slate-800 text-slate-400 text-[9.5px] px-2 py-0.5 rounded font-bold uppercase">{r}</span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-850/80">
                <span className="text-[9.5px] uppercase font-bold text-slate-500 block mb-1">Role Description</span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Specializes in enterprise software architecture, scalable application development, and user experience engineering. Focuses on designing secure, high-performance business systems, optimizing software quality, and driving innovation through modern technologies and best engineering practices.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Right Card: Syed Ansar */}
          <motion.div 
            {...cardHoverProps}
            className="bg-[#050f21] border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl cursor-default"
          >
            <div className="flex gap-4 items-start">
              <ExecutiveAvatar 
                initials="SA" 
                src="/images/leadership/ansar.jpg" 
                size="w-28 h-36" 
                borderAccent="border-emerald-500/60" 
              />
              <div className="flex-1">
                <h3 className="text-base font-extrabold text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Syed Ansar Ali</h3>
                <div className="mt-1">
                  <span className="inline-block px-3 py-1 bg-emerald-950/40 border border-emerald-500/20 rounded-full text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                    DevOps Engineer
                  </span>
                </div>
              </div>
            </div>

            {/* Responsibilities */}
            <div className="space-y-3">
              <div>
                <span className="text-[9.5px] uppercase font-bold text-slate-500 block mb-1">Key Responsibilities</span>
                <div className="flex flex-wrap gap-1.5">
                  {["Cloud Infrastructure", "CI/CD", "Deployment", "Performance", "Security"].map(r => (
                    <span key={r} className="bg-slate-900 border border-slate-800 text-slate-400 text-[9.5px] px-2 py-0.5 rounded font-bold uppercase">{r}</span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-850/80">
                <span className="text-[9.5px] uppercase font-bold text-slate-500 block mb-1">Role Description</span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Directs the SaaS hosting environments setups, automated CI/CD code deployments pipelines, server loading balances, database replications, and system firewalls setups.
                </p>
              </div>
            </div>
          </motion.div>

        </div>
      </motion.section>

      {/* SECTION 4 — Human Resources & Operations */}
      <motion.section 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={scrollVariants}
        className="py-16 px-5 sm:px-8 max-w-5xl mx-auto border-t border-slate-900"
      >
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-black text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
            Human Resources & Operations
          </h2>
        </div>

        <motion.div 
          {...cardHoverProps}
          className="bg-[#050f21] border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row gap-6 items-start shadow-xl cursor-default"
        >
          <ExecutiveAvatar 
            initials="AA" 
            src="/images/leadership/amna.jpg" 
            size="w-28 h-36" 
            borderAccent="border-emerald-500/60" 
          />
          <div className="flex-1 space-y-4 text-center md:text-left mt-4 md:mt-0">
            <div>
              <h3 className="text-base font-extrabold text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Amna Waheed Ahmed</h3>
              <div className="mt-1">
                <span className="inline-block px-3 py-1 bg-emerald-950/40 border border-emerald-500/20 rounded-full text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                  HR Executive
                </span>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-1.5 justify-center md:justify-start">
              {["Recruitment", "Human Resources", "Employee Relations", "Organizational Development", "Administration"].map(r => (
                <span key={r} className="bg-slate-900 border border-slate-800 text-slate-400 text-[9.5px] px-2 py-0.5 rounded font-bold uppercase">{r}</span>
              ))}
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
              Coordinates staffing requirements, manages internal corporate resource channels, regulates employee workflows, and administers general workplace compliance standards to support overall scaling.
            </p>
          </div>
        </motion.div>
      </motion.section>

      {/* SECTION 5 — Finance & Business Intelligence */}
      <motion.section 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={scrollVariants}
        className="py-16 px-5 sm:px-8 max-w-5xl mx-auto border-t border-slate-900"
      >
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-black text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
            Finance & Business Intelligence
          </h2>
        </div>

        <motion.div 
          {...cardHoverProps}
          className="bg-[#050f21] border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row gap-6 items-start shadow-xl cursor-default"
        >
          <ExecutiveAvatar 
            initials="TK" 
            src="/images/leadership/talal.jpg" 
            size="w-28 h-36" 
            borderAccent="border-emerald-500/60" 
          />
          <div className="flex-1 space-y-4 text-center md:text-left mt-4 md:mt-0">
            <div>
              <h3 className="text-base font-extrabold text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Rana Talal Khan</h3>
              <div className="mt-1">
                <span className="inline-block px-3 py-1 bg-emerald-950/40 border border-emerald-500/20 rounded-full text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                  Financial Analyst
                </span>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-1.5 justify-center md:justify-start">
              {["Financial Planning", "Budget Analysis", "Forecasting", "KPI Reporting", "Business Intelligence"].map(r => (
                <span key={r} className="bg-slate-900 border border-slate-800 text-slate-400 text-[9.5px] px-2 py-0.5 rounded font-bold uppercase">{r}</span>
              ))}
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
              Constructs dynamic budget forecasts modeling sheets, reports on key operational liquidity metrics, conducts variance reports audits, and structures business intelligence indicators.
            </p>
          </div>
        </motion.div>
      </motion.section>

      {/* SECTION 6 — Legal Framework & Corporate Compliance */}
      <motion.section 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={scrollVariants}
        className="py-16 px-5 sm:px-8 max-w-5xl mx-auto border-t border-slate-900"
      >
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-black text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
            Legal Framework & Corporate Compliance
          </h2>
        </div>

        {/* Large Highlighted Card */}
        <motion.div 
          whileHover={{ y: -6, scale: 1.005, borderColor: "rgba(16, 185, 129, 0.35)", boxShadow: "0 20px 40px -15px rgba(16, 185, 129, 0.05)" }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="bg-[#050f21] border border-emerald-500/20 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl shadow-emerald-500/2 cursor-default"
        >
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <ExecutiveAvatar 
              initials="FK" 
              src="/images/leadership/farhan.jpg" 
              size="w-32 h-40" 
              borderAccent="border-emerald-400" 
            />
            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div>
                <h3 className="text-lg font-extrabold text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Farhan Ahmed Khokhar</h3>
                <div className="mt-2 flex flex-wrap gap-2 justify-center sm:justify-start">
                  <span className="inline-block px-3 py-1 bg-emerald-950/40 border border-emerald-500/20 rounded-full text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                    Advocate High Court
                  </span>
                  <span className="inline-block px-3 py-1 bg-emerald-950/40 border border-emerald-500/20 rounded-full text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                    Tax & Corporate Law Advisor
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start pt-2">
                {["Corporate Law", "Taxation", "Regulatory Compliance", "Contracts", "Legal Advisory"].map(r => (
                  <span key={r} className="bg-slate-900 border border-slate-800 text-slate-400 text-[9.5px] px-2 py-0.5 rounded font-bold uppercase">{r}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-850 space-y-4">
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Provides strategic legal guidance on software licensing structures, intellectual property frameworks, contract audits templates, and advises on regulatory corporate tax compliance requirements.
            </p>

            <div className="border-l-2 border-emerald-500 pl-4 py-1 italic text-slate-400 text-xs sm:text-sm font-medium">
              "Strong governance and compliance are the foundation of sustainable enterprise growth."
            </div>
          </div>
        </motion.div>
      </motion.section>

      {/* SECTION 7 — Organizational Structure */}
      <motion.section 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={scrollVariants}
        className="py-16 px-5 sm:px-8 max-w-5xl mx-auto border-t border-slate-900"
      >
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-black text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
            Organizational Structure
          </h2>
        </div>

        {/* Visual Hierarchy Tree */}
        <div className="bg-[#050f21] border border-slate-800 rounded-3xl p-8 flex flex-col items-center hover:border-slate-700/60 transition duration-300">
          
          {/* Level 1: CEO */}
          <div className="flex flex-col items-center">
            <motion.div 
              {...treeNodeHoverProps}
              className="bg-slate-950 border border-emerald-500/30 px-6 py-3 rounded-2xl text-center shadow-lg cursor-default"
            >
              <span className="text-[9.5px] text-emerald-400 font-bold uppercase tracking-wider block">CEO & Founder</span>
              <span className="text-xs font-black text-white block mt-0.5">Rana Muhammad Zain</span>
            </motion.div>
            
            {/* Vertical Line */}
            <div className="w-0.5 h-8 bg-slate-800" />
          </div>

          {/* Horizontal Connector bar */}
          <div className="w-[80%] max-w-3xl flex items-center relative">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-slate-800" />
          </div>

          {/* Level 2 drops */}
          <div className="w-[80%] max-w-3xl grid grid-cols-3 text-center">
            
            {/* Column 1: Development */}
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-6 bg-slate-800" />
              <motion.div 
                {...treeNodeHoverProps}
                className="bg-slate-950 border border-emerald-500/30 px-4 py-2.5 rounded-xl mt-1 cursor-default"
              >
                <span className="text-[9px] text-emerald-400 font-bold uppercase block">Core Track</span>
                <span className="text-[11px] font-bold text-white block">Development</span>
                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Ayesha Kashif</span>
              </motion.div>
              
              <div className="w-0.5 h-6 bg-slate-800" />
              {/* DevOps */}
              <motion.div 
                {...treeNodeHoverProps}
                className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl cursor-default"
              >
                <span className="text-[9px] text-slate-500 font-bold uppercase block">Infrastructure</span>
                <span className="text-[11px] font-bold text-white block">DevOps</span>
                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Syed Ansar Ali</span>
              </motion.div>

              <div className="w-0.5 h-6 bg-slate-800" />
              {/* Legal Advisor */}
              <motion.div 
                {...treeNodeHoverProps}
                className="bg-slate-950 border border-emerald-500/20 px-4 py-2.5 rounded-xl cursor-default"
              >
                <span className="text-[9px] text-emerald-400 font-bold uppercase block">Advisory</span>
                <span className="text-[11px] font-bold text-white block">Legal Advisor</span>
                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Farhan Ahmed Khokhar</span>
              </motion.div>
            </div>

            {/* Column 2: Finance */}
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-6 bg-slate-800" />
              <motion.div 
                {...treeNodeHoverProps}
                className="bg-slate-950 border border-emerald-500/20 px-4 py-2.5 rounded-xl mt-1 cursor-default"
              >
                <span className="text-[9px] text-emerald-400 font-bold uppercase block">Core Advisor</span>
                <span className="text-[11px] font-bold text-white block">Professor Saad Anwar Mughal</span>
              </motion.div>
              
              <div className="w-0.5 h-6 bg-slate-800" />
              {/* Financial Analyst */}
              <motion.div 
                {...treeNodeHoverProps}
                className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl cursor-default"
              >
                <span className="text-[9px] text-slate-500 font-bold uppercase block">Analysis</span>
                <span className="text-[11px] font-bold text-white block">Financial Analyst</span>
                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Rana Talal Khan</span>
              </motion.div>
            </div>

            {/* Column 3: Operations */}
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-6 bg-slate-800" />
              <motion.div 
                {...treeNodeHoverProps}
                className="bg-slate-950 border border-emerald-500/20 px-4 py-2.5 rounded-xl mt-1 cursor-default"
              >
                <span className="text-[9px] text-emerald-400 font-bold uppercase block">Core Advisor</span>
                <span className="text-[11px] font-bold text-white block">Professor Muhammad Rehan Anjum</span>
              </motion.div>
              
              <div className="w-0.5 h-6 bg-slate-800" />
              {/* HR */}
              <motion.div 
                {...treeNodeHoverProps}
                className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl cursor-default"
              >
                <span className="text-[9px] text-slate-500 font-bold uppercase block">Management</span>
                <span className="text-[11px] font-bold text-white block">HR</span>
                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Amna Waheed Ahmed</span>
              </motion.div>
            </div>

          </div>
        </div>
      </motion.section>

      {/* SECTION 8 — Full Leadership Directory (Marquee Track) */}
      <motion.section 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={scrollVariants}
        className="py-16 border-t border-slate-900 overflow-hidden relative bg-[#040e1f]"
      >
        {/* Left & Right Fade gradients */}
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#040e1f] to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#040e1f] to-transparent z-10 pointer-events-none" />

        <div className="text-center mb-12 px-5 sm:px-8">
          <h2 className="text-2xl sm:text-3xl font-black text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
            Full Leadership Directory
          </h2>
        </div>

        <div className="relative w-full">
          <div className="animate-lp-marquee">
            {doubledDirectory.map((d, idx) => (
              <motion.div
                key={idx}
                whileHover={{ scale: 1.03, borderColor: "rgba(16, 185, 129, 0.3)" }}
                transition={{ type: "spring", stiffness: 450, damping: 20 }}
                className="flex-shrink-0 flex items-center gap-4 px-6 py-4 bg-slate-950/40 border border-slate-800 rounded-2xl shadow-lg w-[320px] cursor-default"
              >
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold font-mono text-xs flex-shrink-0"
                  style={{
                    backgroundColor: "rgba(16, 185, 129, 0.05)",
                    border: `1.5px solid ${d.accent}`,
                    color: d.accent,
                    boxShadow: `0 0 10px ${d.accent}15`
                  }}
                >
                  {d.initials}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <h4 className="text-xs font-black text-white truncate leading-tight">{d.name}</h4>
                  <p className="text-[9.5px] text-slate-500 font-bold uppercase tracking-wider truncate mt-1">{d.title}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* SECTION 9 — Closing CTA */}
      <motion.section 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={scrollVariants}
        className="py-20 px-5 sm:px-8 text-center max-w-4xl mx-auto relative z-10 border-t border-slate-900"
      >
        <div className="bg-gradient-to-b from-[#050f21] to-[#030b1a] border border-slate-800 rounded-3xl p-8 sm:p-12 space-y-6 transition hover:border-slate-700/60 duration-300 shadow-2xl">
          <h2 className="text-2xl sm:text-4xl font-black text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
            Ready to build the future of enterprise intelligence?
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            <a 
              href="/contact" 
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-3 rounded-xl transition duration-200 shadow-lg shadow-emerald-500/10"
            >
              Request a Demo
            </a>
            <a 
              href="/contact" 
              className="bg-transparent border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white text-xs font-bold px-6 py-3 rounded-xl transition duration-200"
            >
              Contact Leadership
            </a>
          </div>
        </div>
      </motion.section>

      <Footer />
    </motion.div>
  );
}
