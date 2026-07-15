import { useState } from 'react';
import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

// Avatar component supporting image rendering with graceful initials fallback
function ExecutiveAvatar({ initials, src, size = "w-24 h-24", borderAccent = "border-emerald-500" }) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className={`relative flex items-center justify-center rounded-full bg-[#050f21] border-2 ${borderAccent} ${size} shadow-lg shadow-emerald-500/5 overflow-hidden`}>
      {src && !imageError ? (
        <img 
          src={src} 
          alt={initials} 
          className="w-full h-full object-cover" 
          onError={() => setImageError(true)}
        />
      ) : (
        <span className="text-xl font-bold text-white font-mono">{initials}</span>
      )}
      <div className="absolute inset-0 rounded-full bg-emerald-500/5 blur-sm pointer-events-none" />
    </div>
  );
}

export default function LeadershipPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-[#030b1a] min-h-screen text-white font-sans"
    >
      <Navbar />

      {/* Hero Headline Section */}
      <section className="pt-32 pb-16 px-5 sm:px-8 text-center max-w-4xl mx-auto relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/5 text-xs font-semibold tracking-wider text-[#6ee7b7] mb-6 uppercase">
          Corporate Profile
        </div>
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight mb-5" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
          Our{" "}
          <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Leadership
          </span>
        </h1>
        <p className="text-slate-400 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
          Visionaries, academics, and strategic leaders steering the next generation of financial and operational resource planning.
        </p>
      </section>

      {/* SECTION 1 — CEO & FOUNDER (Hero Profile Card) */}
      <section className="py-12 px-5 sm:px-8 max-w-5xl mx-auto">
        <div className="bg-[#050f21] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-6 sm:p-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          
          {/* Left Side: Portrait & Metrics */}
          <div className="md:col-span-5 flex flex-col items-center text-center space-y-6 md:border-r md:border-slate-800/80 md:pr-8">
            <div className="relative p-1.5 rounded-full border-2 border-emerald-500">
              <ExecutiveAvatar 
                initials="RZ" 
                src="/images/leadership/zain.jpg" 
                size="w-36 h-36" 
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
              <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl">
                <h4 className="font-extrabold text-white text-[12.5px] uppercase tracking-wider mb-1 text-emerald-400">Enterprise Vision</h4>
                <p className="text-slate-400 leading-relaxed text-[12px]">
                  SARFIS was designed and engineered to consolidate isolated corporate workflows into a unified, compliant, and real-time enterprise resource platform.
                </p>
              </div>

              <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl">
                <h4 className="font-extrabold text-white text-[12.5px] uppercase tracking-wider mb-1 text-emerald-400">Financial Intelligence</h4>
                <p className="text-slate-400 leading-relaxed text-[12px]">
                  Focuses on executing robust accounting structures, auto-matched journal validations, and audit trails to optimize organizational governance.
                </p>
              </div>

              <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl">
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

        </div>
      </section>

      {/* SECTION 2 — Mentors & Academic Advisors */}
      <section className="py-16 px-5 sm:px-8 max-w-5xl mx-auto border-t border-slate-900">
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
          <div className="bg-[#050f21] border border-slate-800 rounded-3xl p-6 flex flex-col justify-between space-y-6 hover:border-emerald-500/30 transition">
            <div className="space-y-4">
              <div className="flex gap-4 items-center flex-wrap sm:flex-nowrap">
                <ExecutiveAvatar 
                  initials="SM" 
                  src="/images/leadership/saad.jpg" 
                  size="w-16 h-16" 
                  borderAccent="border-emerald-500/60" 
                />
                <div>
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
          </div>

          {/* Card 2: Prof. Rehan */}
          <div className="bg-[#050f21] border border-slate-800 rounded-3xl p-6 flex flex-col justify-between space-y-6 hover:border-emerald-500/30 transition">
            <div className="space-y-4">
              <div className="flex gap-4 items-center flex-wrap sm:flex-nowrap">
                <ExecutiveAvatar 
                  initials="RA" 
                  src="/images/leadership/rehan.jpg" 
                  size="w-16 h-16" 
                  borderAccent="border-emerald-500/60" 
                />
                <div>
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
          </div>

        </div>
      </section>

      {/* SECTION 3 — Strategic Management & Core Development */}
      <section className="py-16 px-5 sm:px-8 max-w-5xl mx-auto border-t border-slate-900">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-black text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
            Strategic Management & Core Development Team
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Left Card: Ayesha */}
          <div className="bg-[#050f21] border border-slate-800 rounded-3xl p-6 space-y-6 hover:border-emerald-500/30 transition">
            <div className="flex gap-4 items-center">
              <ExecutiveAvatar 
                initials="AK" 
                src="/images/leadership/ayesha.jpg" 
                size="w-16 h-16" 
                borderAccent="border-emerald-500/60" 
              />
              <div>
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
                <span className="text-[9.5px] uppercase font-bold text-slate-500 block mb-1">Key Responsibilities</span>
                <div className="flex flex-wrap gap-1.5">
                  {["ERP Architecture", "UI/UX Design", "Product Strategy", "Technical Leadership", "Enterprise Platform Design"].map(r => (
                    <span key={r} className="bg-slate-900 border border-slate-800 text-slate-400 text-[9.5px] px-2 py-0.5 rounded font-bold uppercase">{r}</span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-850/80">
                <span className="text-[9.5px] uppercase font-bold text-slate-500 block mb-1">Role Description</span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Steers and implements the software engineering codebase architecture, UI components layouts, data pipelines schemas, and the product roadmap trajectory.
                </p>
              </div>
            </div>
          </div>

          {/* Right Card: Syed Ansar */}
          <div className="bg-[#050f21] border border-slate-800 rounded-3xl p-6 space-y-6 hover:border-emerald-500/30 transition">
            <div className="flex gap-4 items-center">
              <ExecutiveAvatar 
                initials="SA" 
                src="/images/leadership/ansar.jpg" 
                size="w-16 h-16" 
                borderAccent="border-emerald-500/60" 
              />
              <div>
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
          </div>

        </div>
      </section>

      {/* SECTION 4 — Human Resources & Operations */}
      <section className="py-16 px-5 sm:px-8 max-w-5xl mx-auto border-t border-slate-900">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-black text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
            Human Resources & Operations
          </h2>
        </div>

        <div className="bg-[#050f21] border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row gap-6 items-center">
          <ExecutiveAvatar 
            initials="AA" 
            src="/images/leadership/amna.jpg" 
            size="w-20 h-20" 
            borderAccent="border-emerald-500/60" 
          />
          <div className="flex-1 space-y-4 text-center md:text-left">
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
        </div>
      </section>

      {/* SECTION 5 — Finance & Business Intelligence */}
      <section className="py-16 px-5 sm:px-8 max-w-5xl mx-auto border-t border-slate-900">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-black text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
            Finance & Business Intelligence
          </h2>
        </div>

        <div className="bg-[#050f21] border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row gap-6 items-center">
          <ExecutiveAvatar 
            initials="TK" 
            src="/images/leadership/talal.jpg" 
            size="w-20 h-20" 
            borderAccent="border-emerald-500/60" 
          />
          <div className="flex-1 space-y-4 text-center md:text-left">
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
        </div>
      </section>

      {/* SECTION 6 — Legal Framework & Corporate Compliance */}
      <section className="py-16 px-5 sm:px-8 max-w-5xl mx-auto border-t border-slate-900">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-black text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
            Legal Framework & Corporate Compliance
          </h2>
        </div>

        {/* Large Highlighted Card */}
        <div className="bg-[#050f21] border border-emerald-500/20 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl shadow-emerald-500/2">
          <div className="flex flex-col sm:flex-row gap-6 items-center">
            <ExecutiveAvatar 
              initials="FK" 
              src="/images/leadership/farhan.jpg" 
              size="w-24 h-24" 
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
        </div>
      </section>

      {/* SECTION 7 — Organizational Structure */}
      <section className="py-16 px-5 sm:px-8 max-w-5xl mx-auto border-t border-slate-900">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-black text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
            Organizational Structure
          </h2>
        </div>

        {/* Visual Hierarchy Tree */}
        <div className="bg-[#050f21] border border-slate-800 rounded-3xl p-8 flex flex-col items-center">
          
          {/* Level 1: CEO */}
          <div className="flex flex-col items-center">
            <div className="bg-slate-950 border border-emerald-500/30 px-6 py-3 rounded-2xl text-center shadow-lg">
              <span className="text-[9.5px] text-emerald-400 font-bold uppercase tracking-wider block">CEO & Founder</span>
              <span className="text-xs font-black text-white">Rana Muhammad Zain</span>
            </div>
            
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
              <div className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl mt-1">
                <span className="text-[9px] text-slate-500 font-bold uppercase block">Core Track</span>
                <span className="text-[11px] font-bold text-white">Development</span>
              </div>
              
              <div className="w-0.5 h-6 bg-slate-800" />
              {/* DevOps */}
              <div className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl">
                <span className="text-[9px] text-slate-500 font-bold uppercase block">Infrastructure</span>
                <span className="text-[11px] font-bold text-white">DevOps</span>
              </div>

              <div className="w-0.5 h-6 bg-slate-800" />
              {/* Legal Advisor (linked under DevOps in reference structure) */}
              <div className="bg-slate-950 border border-emerald-500/20 px-4 py-2.5 rounded-xl">
                <span className="text-[9px] text-emerald-400 font-bold uppercase block">Advisory</span>
                <span className="text-[11px] font-bold text-white">Legal Advisor</span>
              </div>
            </div>

            {/* Column 2: Finance */}
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-6 bg-slate-800" />
              <div className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl mt-1">
                <span className="text-[9px] text-slate-500 font-bold uppercase block">Core Track</span>
                <span className="text-[11px] font-bold text-white">Finance</span>
              </div>
              
              <div className="w-0.5 h-6 bg-slate-800" />
              {/* Financial Analyst */}
              <div className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl">
                <span className="text-[9px] text-slate-500 font-bold uppercase block">Analysis</span>
                <span className="text-[11px] font-bold text-white">Financial Analyst</span>
              </div>
            </div>

            {/* Column 3: Operations */}
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-6 bg-slate-800" />
              <div className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl mt-1">
                <span className="text-[9px] text-slate-500 font-bold uppercase block">Core Track</span>
                <span className="text-[11px] font-bold text-white">Operations</span>
              </div>
              
              <div className="w-0.5 h-6 bg-slate-800" />
              {/* HR */}
              <div className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl">
                <span className="text-[9px] text-slate-500 font-bold uppercase block">Management</span>
                <span className="text-[11px] font-bold text-white">HR</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* SECTION 8 — Full Leadership Directory */}
      <section className="py-16 px-5 sm:px-8 max-w-5xl mx-auto border-t border-slate-900">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-black text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
            Full Leadership Directory
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { name: "Rana Muhammad Zain Ul Abideen", title: "CEO & Founder" },
            { name: "Professor Saad Anwar Mughal", title: "Taxation & Financial Governance Advisor" },
            { name: "Professor Muhammad Rehan Anjum", title: "Accounting & IFRS Advisor" },
            { name: "Ayesha Kashif", title: "Lead Developer & Co-Founder" },
            { name: "Amna Waheed Ahmed", title: "HR Executive" },
            { name: "Rana Talal Khan", title: "Financial Analyst" },
            { name: "Syed Ansar Ali", title: "DevOps Engineer" },
            { name: "Farhan Ahmed Khokhar", title: "Advocate High Court • Tax & Corporate Law Advisor" }
          ].map(d => (
            <div key={d.name} className="p-4 bg-[#050f21] border border-slate-800 rounded-2xl flex flex-col justify-center">
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">{d.title}</span>
              <span className="text-sm font-black text-white mt-1">{d.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 9 — Closing CTA */}
      <section className="py-20 px-5 sm:px-8 text-center max-w-4xl mx-auto relative z-10 border-t border-slate-900">
        <div className="bg-gradient-to-b from-[#050f21] to-[#030b1a] border border-slate-800 rounded-3xl p-8 sm:p-12 space-y-6">
          <h2 className="text-2xl sm:text-4xl font-black text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
            Ready to build the future of enterprise intelligence?
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            <a 
              href="/contact" 
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-3 rounded-xl transition duration-200"
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
      </section>

      <Footer />
    </motion.div>
  );
}
