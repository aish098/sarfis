import { useState, useEffect, useRef } from 'react';
import { motion as M, AnimatePresence } from 'framer-motion';
import { 
  Building2, Users, Briefcase, Award, GraduationCap, ChevronRight, 
  CheckCircle2, Quote, Compass, ShieldCheck, Scale, BarChart3, 
  Clock, LineChart, FileText, ArrowDown, ArrowRight, Zap, 
  Target, BookOpen, Lock, Globe, Sparkles, Server, Check
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

/* ═══ DESIGN SYSTEM TOKENS ══════════════════════════════════════════════════════ */
const C = {
  bg: '#030b1a',
  card: '#050f21',
  cardDeep: '#020712',
  border: 'rgba(255, 255, 255, 0.06)',
  borderActive: 'rgba(16, 185, 129, 0.3)',
  emerald: '#10b981',
  emeraldLt: '#34d399',
  teal: '#0d9488',
  cyan: '#06b6d4',
  textPri: '#ffffff',
  textSec: '#94a3b8',
  textDim: '#475569',
};

/* ═══ CUSTOM SYSTEM STYLES ══════════════════════════════════════════════════════ */
if (typeof document !== 'undefined' && !document.getElementById('sarfis-leadership-core-styles')) {
  const s = document.createElement('style');
  s.id = 'sarfis-leadership-core-styles';
  s.textContent = `
    .lead-card-hover {
      transition: all 0.35s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .lead-card-hover:hover {
      transform: translateY(-5px);
      border-color: rgba(16, 185, 129, 0.25) !important;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5), 0 0 1px 1px rgba(16, 185, 129, 0.1) inset;
    }
    .avatar-glow {
      box-shadow: 0 0 20px rgba(16, 185, 129, 0.1);
      transition: all 0.35s ease;
    }
    .avatar-glow:hover {
      box-shadow: 0 0 25px rgba(16, 185, 129, 0.25);
      border-color: #34d399 !important;
    }
    .org-node {
      transition: all 0.3s ease;
    }
    .org-node:hover {
      border-color: #10b981 !important;
      background: rgba(16, 185, 129, 0.05) !important;
    }
    .timeline-dot {
      box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.15);
    }
  `;
  document.head.appendChild(s);
}

/* ═══ DATA STRUCTURES ═════════════════════════════════════════════════════════ */
const FOUNDERS = [
  {
    name: "Rana Muhammad Zain Ul Abideen",
    title: "CEO & Founder",
    initials: "RZ",
    tagline: "Architecting the Core Engines of Financial Intelligence",
    metrics: [
      { val: "12+", label: "Years Experience" },
      { val: "8+", label: "ERP Architectures" },
      { val: "50+", label: "Enterprise Clients" }
    ],
    mission: "To eliminate the friction in corporate financial auditing and enable real-time operational truth for enterprise teams.",
    bio: "Rana Zain is an expert in double-entry bookkeeping ledgers and transaction pipeline engineering. He designed SARFIS's core multi-company consolidation logic and led the execution of the initial general ledger architecture. Having consultatively scaled financial infrastructure for over 50 large companies, Zain guides the long-term system design and architectural rules of the platform.",
    vision: "Developing a fully autonomous general ledger network that reconciles multi-subsidiary cash flows without manual overhead.",
    philosophy: "Precision is not an option; it is the infrastructure. Every line of accounting must be fully auditable, traceable, and instantly verifiable.",
    expertise: ["Enterprise Ledger Design", "IFRS Data Standards", "Transaction Auditing Pipelines", "Financial Systems Engineering", "Multi-Tenant Scaling"],
    accent: C.emerald
  },
  {
    name: "Ayesha Kashif",
    title: "Lead Developer & Co-Founder",
    initials: "AK",
    tagline: "Driving Strategic Scaling and Design-First Excellence",
    metrics: [
      { val: "6+", label: "Years Experience" },
      { val: "15+", label: "SaaS Deployments" },
      { val: "100%", label: "Client Retention" }
    ],
    mission: "To deliver accessible, high-performance financial workspaces that enterprise leaders trust to run daily operations.",
    bio: "Ayesha Kashif drives the global business strategy, software architecture, and frontend design patterns at SARFIS. She specializes in optimizing complex transaction workflows into clean, card-first layouts that minimize clicks. Ayesha's focus on regulatory alignment and security standards has positioned SARFIS as a leading choice for mid-market and enterprise organizations.",
    vision: "To position SARFIS as the definitive financial operating system for multi-entity corporations globally.",
    philosophy: "Complexity should live in the engine, never on the user's screen. If a financial manager cannot audit a record in three clicks, we redesign it.",
    expertise: ["SaaS Operations", "Product Interface Strategy", "GTM Execution Models", "Corporate Compliance Oversight", "Stakeholder Relations"],
    accent: C.cyan
  }
];

const ADVISORS = [
  {
    name: "Professor Saad Anwar Mughal",
    title: "Taxation & Audit Advisor",
    initials: "SM",
    specialization: "Corporate Taxation & Auditing",
    experience: "15+ Years",
    certifications: ["Tax Law Authority", "Corporate Legal Consultant"],
    expertise: ["FBR Compliance", "Sales Tax Structuring", "Legal Risk Management"],
    bio: "Saad Anwar Mughal provides high-level guidance on taxation pipelines, tax engine structures, and FBR integration rules. His oversight ensures all transaction filings comply with corporate laws.",
    accent: C.emerald
  },
  {
    name: "Professor Muhammad Rehan Anjum",
    title: "IFRS Compliance Advisor",
    initials: "RA",
    specialization: "IFRS Auditing Standards",
    experience: "18+ Years",
    certifications: ["IFRS Chartered Consultant", "Senior Ledger Auditor"],
    expertise: ["GAAP Reconciliation", "Subsidiary Elimination", "Financial Governance"],
    bio: "Rehan Anjum advises on data governance, straight-line depreciation validation, and consolidation rules, guaranteeing that SARFIS reports meet global accounting guidelines.",
    accent: C.cyan
  }
];

const STRATEGIC_TEAMS = [
  {
    title: "Executive Steering",
    desc: "Guides general ledger development, long-term roadmaps, and global entity positioning.",
    members: "Founder, CEO",
    responsibilities: "Capital allocation, architecture standards, regulatory alignment.",
    icon: Compass,
    color: C.emerald
  },
  {
    title: "Technology & Product",
    desc: "Builds high-performance transaction matching pipelines, web dashboards, and database models.",
    members: "Lead Architect, Backend Devs, Frontend Engineers",
    responsibilities: "Double-entry validation, ledger queries, database performance, UI responsiveness.",
    icon: Server,
    color: C.cyan
  },
  {
    title: "Finance & Governance",
    desc: "Ensures accounting automation complies with international accounting principles and local tax regulations.",
    members: "Compliance Officers, Taxation Consultants",
    responsibilities: "Consolidation verification, IFRS schema mapping, tax formula audits.",
    icon: Scale,
    color: C.teal
  },
  {
    title: "Ops & Customer Success",
    desc: "Coordinates multi-company client onboarding, data migrations, and SLA compliance support.",
    members: "Operations Managers, Customer Success Directors",
    responsibilities: "Data pipeline migrations, user training, workspace configuration.",
    icon: Users,
    color: C.emerald
  }
];

const TIMELINE_STEPS = [
  { year: "2022", title: "Founded SARFIS", desc: "Established with the core vision of building a robust, auditable general ledger platform." },
  { year: "2023", title: "Core Ledger Architecture", desc: "Completed the double-entry transaction database schema with full auditing tracks." },
  { year: "2024", title: "Voucher & Matching Engine", desc: "Rolled out automated AP/AR matching mechanisms with rule-based approvals." },
  { year: "2024", title: "Asset & Depreciation Logic", desc: "Integrated asset registers supporting automated Straight-Line depreciation." },
  { year: "2025", title: "Payroll & Compensation Engine", desc: "Launched multi-branch payroll runs integrated with withholding tax rules." },
  { year: "2025", title: "BI & Financial Reporting", desc: "Deployed dynamic, multi-company consolidated cash flow and P&L dashboards." },
  { year: "2026", title: "Advanced Migration Tooling", desc: "Introduced advanced Excel migration wizards for onboarding legacy ledger balances." },
  { year: "Future", title: "Next-Gen Enterprise Engine", desc: "Expanding system architectures to support automated inter-ledger blockchain settlement." }
];

const PHILOSOPHIES = [
  { title: "Precision over Complexity", desc: "We prioritize structured, clean ledger math over convoluted systems. Clarity drives trust.", icon: Target },
  { title: "Enterprise by Design", desc: "From day one, SARFIS is architected for multi-company operations, large datasets, and strict role hierarchies.", icon: Building2 },
  { title: "Finance First", desc: "We build for accountants, not just technologists. Financial reality always dictates product logic.", icon: BarChart3 },
  { title: "Automation with Trust", desc: "Every automated posting requires explicit verification rules and complete visual logs.", icon: Lock },
  { title: "User Experience Matters", desc: "Enterprise tools do not need to look dated. We create modern, fast, and satisfying workspaces.", icon: Sparkles }
];

const CORE_TEAM_MEMBERS = [
  { name: "Farhan Ahmed Khokhar", role: "Advocate High Court | Tax & Corporate Law Advisor", dept: "Operations", status: "Active", initials: "FK", desc: "Handles legal framework templates, corporate litigation consulting, and FBR tax representation." },
  { name: "Amna Waheed Ahmed", role: "HR Executive", dept: "Operations", status: "Active", initials: "AW", desc: "Coordinates talent acquisition, internal policy management, and resource planning for SARFIS." },
  { name: "Rana Talal Khan", role: "Financial Analyst", dept: "Finance", status: "Active", initials: "TK", desc: "Analyzes general ledger variance, compliance reporting logic, and cash flow structures." },
  { name: "Syed Ansar Ali", role: "DevOps Engineer", dept: "Engineering", status: "Active", initials: "AA", desc: "Manages ledger database replication, server security layers, and cloud infrastructure scale." }
];

const WHY_TRUST_US = [
  { title: "Enterprise Accounting Experts", desc: "Our leadership team comprises professionals who have configured accounting systems for decades." },
  { title: "Tax Professionals", desc: "Taxation rules are overseen by legal and auditing authorities to match regulatory changes." },
  { title: "ERP Architects", desc: "SARFIS was written by builders who understand scaling database schemas for thousands of transactions." },
  { title: "Financial Analysts", desc: "We translate accounting details into direct, actionable business indicators." },
  { title: "Software Engineers", desc: "Our developers focus on high concurrency, query execution speed, and database security." },
  { title: "Business Consultants", desc: "We work directly with corporate leaders to configure optimized operations and layouts." }
];

const VALUES = [
  { title: "Integrity", desc: "Our platform holds transaction logs that are completely immutable, preventing data alterations.", icon: Lock },
  { title: "Innovation", desc: "We bring modern, card-first UI designs to traditional general ledger administration.", icon: Sparkles },
  { title: "Precision", desc: "Ledgers must balance. We build strict GAAP/IFRS validation directly into database constraints.", icon: Target },
  { title: "Security", desc: "Data is encrypted in transit and at rest, protecting sensitive multi-company financial data.", icon: ShieldCheck },
  { title: "Transparency", desc: "Our audit logs capture every creation, update, approval, and posting event clearly.", icon: FileText },
  { title: "Compliance", desc: "We track and adopt international rules and local corporate tax changes automatically.", icon: Scale },
  { title: "Customer Success", desc: "We support migrations personally, ensuring legacy balances transition seamlessly.", icon: Users },
  { title: "Continuous Learning", desc: "We iterate our technology continuously based on client reviews and operational feedback.", icon: Clock }
];

/* ═══ 3D CANVAS BACKGROUND ════════════════════════════════════════════════════ */
function ParticleBackground() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId, width, height, particles = [];
    const colors = ['rgba(16, 185, 129, 0.12)', 'rgba(6, 182, 212, 0.08)', 'rgba(13, 148, 136, 0.08)'];
    
    const resize = () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    
    const createParticle = () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.5 + 0.5,
      vx: (Math.random() - 0.5) * 0.1,
      vy: (Math.random() - 0.5) * 0.1,
      color: colors[Math.floor(Math.random() * colors.length)]
    });
    
    const init = () => {
      particles = Array.from({ length: 40 }, createParticle);
    };
    
    const render = () => {
      ctx.clearRect(0, 0, width, height);
      
      // Draw links
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dist = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
          if (dist < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(16, 185, 129, ${0.03 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      
      // Draw particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      });
      
      animationFrameId = requestAnimationFrame(render);
    };
    
    resize();
    init();
    render();
    
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, []);
  
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

/* ═══ CUSTOM STYLISH AVATAR ═══════════════════════════════════════════════════ */
function CustomExecutiveAvatar({ initials, name, size = 180, borderCol = C.emerald }) {
  return (
    <div 
      className="relative flex items-center justify-center rounded-2xl overflow-hidden avatar-glow border border-slate-800 bg-[#040e1f] select-none"
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      {/* Background Matrix Effect */}
      <div 
        className="absolute inset-0 opacity-[0.12] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(16, 185, 129, 0.4) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-950/90 to-transparent pointer-events-none z-10" />
      
      {/* Ambient background glow ring */}
      <div 
        className="absolute w-[120%] h-[120%] rounded-full opacity-[0.25] pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${borderCol} 0%, transparent 60%)`,
          filter: 'blur(30px)'
        }}
      />

      <span 
        className="text-[44px] font-black tracking-widest text-slate-100 z-20 font-mono"
        style={{ color: '#f8fafc' }}
      >
        {initials}
      </span>
      
      {/* Bottom border indicator bar */}
      <div className="absolute bottom-0 inset-x-0 h-[3px] z-30" style={{ backgroundColor: borderCol }} />
    </div>
  );
}

export default function LeadershipPage() {
  const [activeOrgTab, setActiveOrgTab] = useState('executive');

  return (
    <M.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      style={{ backgroundColor: C.bg, minHeight: '100vh', color: '#fff' }}
    >
      <Navbar />

      {/* 1. HERO SECTION */}
      <section className="relative min-h-[70vh] flex flex-col items-center justify-center pt-32 pb-20 px-5 text-center overflow-hidden border-b border-slate-900 bg-slate-950/20">
        <ParticleBackground />
        
        {/* Soft background glow */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[300px] rounded-full pointer-events-none opacity-20"
          style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 70%)', filter: 'blur(100px)' }} />

        <div className="max-w-4xl mx-auto relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-xs font-semibold text-emerald-400 uppercase tracking-widest">
            SARFIS Corporate Governance
          </div>
          
          <h1 className="text-5xl sm:text-6xl font-black text-white tracking-tight leading-tight"
            style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
            Leadership & <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Governance</span>
          </h1>
          
          <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Meet the founders, advisors, architects, and professionals building the future of enterprise intelligence through SARFIS.
          </p>

          {/* Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-6 pt-12 border-t border-slate-900 max-w-4xl mx-auto text-left">
            {[
              { val: "12+", label: "Years" },
              { val: "50+", label: "Companies" },
              { val: "8", label: "ERP Modules" },
              { val: "3+", label: "Countries" },
              { val: "100+", label: "Projects" },
              { val: "100%", label: "Traceability" }
            ].map((stat, i) => (
              <div key={i} className="space-y-1">
                <div className="text-3xl font-black text-emerald-400 font-mono">{stat.val}</div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2. FOUNDER & CEO SPOTLIGHTS */}
      <section className="py-24 px-5 sm:px-8 bg-[#030b1a] relative z-10">
        <div className="max-w-6xl mx-auto space-y-24">
          <div className="border-b border-slate-900 pb-4 text-left">
            <h2 className="text-3xl font-black tracking-tight text-white uppercase" style={{ fontFamily: "'Sora', sans-serif" }}>
              Corporate Founders
            </h2>
            <p className="text-slate-500 text-sm mt-1">The strategic leaders establishing the platform's vision, logic, and operational frameworks.</p>
          </div>

          {FOUNDERS.map((founder, index) => (
            <div 
              key={index} 
              className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch"
            >
              {/* LEFT Column: Photo & Metrics */}
              <div className="lg:col-span-4 flex flex-col justify-between items-center p-8 bg-[#050f21] border border-slate-900 rounded-3xl text-center space-y-8 h-full">
                <div className="space-y-4 flex flex-col items-center">
                  <CustomExecutiveAvatar initials={founder.initials} borderCol={founder.accent} />
                  <div>
                    <h3 className="text-xl font-bold text-white leading-tight">{founder.name}</h3>
                    <p className="text-xs font-bold uppercase tracking-widest mt-1.5" style={{ color: founder.accent }}>
                      {founder.title}
                    </p>
                  </div>
                </div>

                {/* Founder Metrics */}
                <div className="grid grid-cols-3 gap-2 w-full pt-6 border-t border-slate-900/60">
                  {founder.metrics.map((m, idx) => (
                    <div key={idx} className="text-center">
                      <div className="text-lg font-black text-white font-mono">{m.val}</div>
                      <div className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT Column: Mission, Bio, Values, Quote */}
              <div className="lg:col-span-8 p-8 bg-[#050f21] border border-slate-900 rounded-3xl flex flex-col justify-between space-y-6 h-full text-left">
                <div className="space-y-5">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Corporate Mission</span>
                    <h4 className="text-[15px] font-extrabold text-slate-200 leading-snug">"{founder.mission}"</h4>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Professional Biography</span>
                    <p className="text-slate-400 text-xs leading-relaxed">{founder.bio}</p>
                  </div>

                  {/* Core Expertise Tags */}
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-2">Core Expertise</span>
                    <div className="flex flex-wrap gap-2">
                      {founder.expertise.map((tag, idx) => (
                        <span key={idx} className="px-2.5 py-1 bg-slate-950 border border-slate-900 text-slate-400 text-[10px] font-semibold rounded-lg">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Philosophy and Quote */}
                <div className="pt-6 border-t border-slate-900/60 space-y-3">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Leadership Philosophy</span>
                  <div className="p-4 bg-slate-950/60 border border-slate-900 rounded-2xl flex items-start gap-3">
                    <Quote size={20} className="text-slate-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-400 italic leading-relaxed">
                      {founder.philosophy}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. ADVISORY BOARD SECTION */}
      <section className="py-24 px-5 sm:px-8 bg-slate-950/30 border-t border-slate-900 relative">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs text-cyan-400 font-bold uppercase tracking-widest">Independent Audit & Council</span>
            <h2 className="text-3xl font-black text-white uppercase" style={{ fontFamily: "'Sora', sans-serif" }}>
              Mentors & Academic Advisors
            </h2>
            <p className="text-slate-400 text-sm">
              Distinguished practitioners overseeing tax pipelines, financial rules, compliance structures, and audit integration frameworks.
            </p>
          </div>

          {/* Advisors Responsive Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8">
            {ADVISORS.map((adv, idx) => (
              <div 
                key={idx} 
                className="lead-card-hover bg-[#050f21] border border-slate-900 rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6 text-left"
              >
                <div className="space-y-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-900 flex items-center justify-center font-bold text-white font-mono text-sm"
                      style={{ borderLeft: `3px solid ${adv.accent}` }}>
                      {adv.initials}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">{adv.name}</h3>
                      <p className="text-[11px] text-slate-400 font-bold mt-0.5">{adv.title}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 bg-slate-950 border border-slate-900 text-slate-500 text-[9px] font-black uppercase tracking-wider rounded">
                      Experience: {adv.experience}
                    </span>
                    {adv.certifications.map((cert, i) => (
                      <span key={i} className="px-2 py-0.5 bg-slate-950 border border-slate-900 text-emerald-400 text-[9px] font-bold rounded">
                        {cert}
                      </span>
                    ))}
                  </div>

                  <p className="text-slate-400 text-xs leading-relaxed">
                    {adv.bio}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-900 space-y-2">
                  <span className="text-[9.5px] text-slate-500 font-bold uppercase tracking-wider block">Areas of Council</span>
                  <div className="flex flex-wrap gap-2">
                    {adv.expertise.map((exp, i) => (
                      <span key={i} className="px-2.5 py-1 bg-slate-950/80 text-slate-300 text-[10px] rounded-lg border border-slate-900">
                        {exp}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. STRATEGIC LEADERSHIP GROUPS */}
      <section className="py-24 px-5 sm:px-8 bg-[#030b1a] relative z-10 border-t border-slate-900">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs text-emerald-400 font-bold uppercase tracking-widest">Organizational Alignment</span>
            <h2 className="text-3xl font-black text-white uppercase" style={{ fontFamily: "'Sora', sans-serif" }}>
              Strategic Leadership Team
            </h2>
            <p className="text-slate-400 text-sm">
              Our organizational setup is divided into specialized operational clusters to maintain complete control over code development, tax alignment, and legal setups.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-8">
            {STRATEGIC_TEAMS.map((team, idx) => {
              const Icon = team.icon;
              return (
                <div 
                  key={idx}
                  className="lead-card-hover bg-[#050f21] border border-slate-900 rounded-3xl p-6 flex flex-col justify-between space-y-5 text-left"
                >
                  <div className="space-y-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-900 flex items-center justify-center"
                      style={{ color: team.color }}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{team.title}</h3>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{team.desc}</p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-slate-900 text-[11px]">
                    <div>
                      <span className="text-slate-500 font-semibold block uppercase tracking-wider text-[9px]">Members</span>
                      <span className="text-slate-300 font-bold">{team.members}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold block uppercase tracking-wider text-[9px]">Scope of Control</span>
                      <span className="text-slate-400 leading-normal block">{team.responsibilities}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. ORGANIZATIONAL STRUCTURE TREE */}
      <section className="py-24 px-5 sm:px-8 bg-slate-950/20 border-t border-slate-900 relative">
        <div className="max-w-4xl mx-auto space-y-12 text-center">
          <div className="space-y-3">
            <span className="text-xs text-emerald-400 font-bold uppercase tracking-widest">Governance Architecture</span>
            <h2 className="text-3xl font-black text-white uppercase" style={{ fontFamily: "'Sora', sans-serif" }}>
              Operational Tree
            </h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              Interactive structural map of corporate control at SARFIS. Click sections below to highlight departments.
            </p>
          </div>

          {/* Org Tree Tabs */}
          <div className="flex justify-center gap-2 border-b border-slate-900 pb-4 max-w-md mx-auto">
            {['executive', 'operations', 'engineering'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveOrgTab(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition border cursor-pointer ${
                  activeOrgTab === tab 
                    ? 'bg-slate-900 text-white border-emerald-500/40' 
                    : 'bg-transparent text-slate-500 border-transparent hover:text-slate-300'
                }`}
              >
                {tab} View
              </button>
            ))}
          </div>

          {/* Live Org Tree Map */}
          <div className="p-8 bg-[#050f21] border border-slate-900 rounded-3xl relative overflow-hidden flex flex-col items-center space-y-6">
            
            {/* Level 1 */}
            <div className="org-node px-6 py-3 bg-slate-950 border border-slate-850 rounded-xl text-xs text-center w-56">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-bold">Shareholders & Chairman</span>
              <span className="text-white font-bold block mt-0.5">Rana M. Zain</span>
            </div>

            <ArrowDown size={14} className="text-emerald-500/50" />

            {/* Level 2 */}
            <div className="org-node px-6 py-3 bg-slate-950 border border-slate-850 rounded-xl text-xs text-center w-56">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-bold">Chief Executive Officer</span>
              <span className="text-cyan-400 font-bold block mt-0.5">Ayesha Kashif</span>
            </div>

            <div className="w-px h-6 bg-emerald-500/30" />

            {/* Horizontal Line connecting Level 3 */}
            <div className="w-full max-w-md border-t border-emerald-500/30 relative">
              <div className="absolute left-0 top-0 w-px h-4 bg-emerald-500/30" />
              <div className="absolute left-1/2 top-0 -translate-x-1/2 w-px h-4 bg-emerald-500/30" />
              <div className="absolute right-0 top-0 w-px h-4 bg-emerald-500/30" />
            </div>

            {/* Level 3 */}
            <div className="grid grid-cols-3 gap-4 w-full max-w-lg text-[10.5px]">
              <div className={`p-3 rounded-xl border text-center transition ${activeOrgTab === 'engineering' ? 'border-cyan-500/40 bg-cyan-950/10' : 'border-slate-855 bg-slate-950'}`}>
                <span className="font-bold text-slate-400 block">Technology</span>
                <span className="text-[9px] text-slate-600 font-semibold block uppercase mt-1">Systems & Dev</span>
              </div>
              <div className={`p-3 rounded-xl border text-center transition ${activeOrgTab === 'operations' ? 'border-teal-500/40 bg-teal-950/10' : 'border-slate-855 bg-slate-950'}`}>
                <span className="font-bold text-slate-400 block">Audit & Law</span>
                <span className="text-[9px] text-slate-600 font-semibold block uppercase mt-1">Tax & Regulations</span>
              </div>
              <div className={`p-3 rounded-xl border text-center transition ${activeOrgTab === 'executive' ? 'border-emerald-500/40 bg-emerald-950/10' : 'border-slate-855 bg-slate-950'}`}>
                <span className="font-bold text-slate-400 block">Ops steering</span>
                <span className="text-[9px] text-slate-600 font-semibold block uppercase mt-1">Admin & Support</span>
              </div>
            </div>

            <div className="w-full max-w-lg flex justify-between relative px-6">
              <div className="w-px h-4 bg-emerald-500/20" />
              <div className="w-px h-4 bg-emerald-500/20" />
              <div className="w-px h-4 bg-emerald-500/20" />
            </div>

            {/* Level 4 */}
            <div className="grid grid-cols-3 gap-4 w-full max-w-lg text-[9.5px] text-slate-500 font-bold uppercase tracking-wider">
              <div className="text-center">Engineering / QA</div>
              <div className="text-center">FBR / IFRS audits</div>
              <div className="text-center">Legal / HR</div>
            </div>

          </div>
        </div>
      </section>

      {/* 6. MISSION TIMELINE SECTION */}
      <section className="py-24 px-5 sm:px-8 bg-[#030b1a] relative z-10 border-t border-slate-900">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs text-emerald-400 font-bold uppercase tracking-widest">Platform Progress Track</span>
            <h2 className="text-3xl font-black text-white uppercase" style={{ fontFamily: "'Sora', sans-serif" }}>
              Development Timeline
            </h2>
            <p className="text-slate-400 text-sm">
              The engineering roadmap and historical development of the SARFIS Financial platform modules.
            </p>
          </div>

          {/* Timeline Tree Component */}
          <div className="relative border-l border-slate-800 ml-4 md:ml-8 space-y-8 pt-6 max-w-3xl mx-auto text-left">
            {TIMELINE_STEPS.map((step, idx) => (
              <div key={idx} className="relative pl-8 group">
                {/* Connector Dot */}
                <div className="timeline-dot absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-emerald-500 border border-slate-950 transition group-hover:bg-cyan-400" />
                
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-950/40 border border-emerald-900/30 px-2 py-0.5 rounded">
                      {step.year}
                    </span>
                    <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed max-w-2xl">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. LEADERSHIP PHILOSOPHIES */}
      <section className="py-24 px-5 sm:px-8 bg-slate-950/20 border-t border-slate-900 relative">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs text-cyan-400 font-bold uppercase tracking-widest">Core Mindset</span>
            <h2 className="text-3xl font-black text-white uppercase" style={{ fontFamily: "'Sora', sans-serif" }}>
              Leadership Philosophy
            </h2>
            <p className="text-slate-400 text-sm">
              The fundamental guidelines shaping how we write code, formulate schemas, and support enterprise accounts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 pt-8">
            {PHILOSOPHIES.map((phi, idx) => {
              const Icon = phi.icon;
              return (
                <div 
                  key={idx}
                  className="lead-card-hover bg-[#050f21] border border-slate-900 rounded-3xl p-6 flex flex-col justify-between space-y-4 text-left"
                >
                  <div className="space-y-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-900 flex items-center justify-center text-cyan-400">
                      <Icon size={16} />
                    </div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">{phi.title}</h3>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{phi.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 8. ACADEMIC & PROFESSIONAL ADVISORY REGISTRY */}
      <section className="py-24 px-5 sm:px-8 bg-[#030b1a] relative z-10 border-t border-slate-900">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs text-emerald-400 font-bold uppercase tracking-widest">Specialized Compliance Consultants</span>
            <h2 className="text-3xl font-black text-white uppercase" style={{ fontFamily: "'Sora', sans-serif" }}>
              Advisory Registry
            </h2>
            <p className="text-slate-400 text-sm">
              Our accounting engines undergo direct reviews by independent professionals specializing in IFRS compliance and tax laws.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
            {[
              { role: "Taxation Architecture", specialist: "Prof. Mohammad Saad Anwar", domain: "FBR Filing Schedules", contribution: "Designs and audits calculation rules for dynamic withholding tax registers." },
              { role: "IFRS Regulatory Compliance", specialist: "Prof. Muhammed Rehan Anjum", domain: "GAAP System Rules", contribution: "Audits asset straight-line formulas and multi-subsidiary elimination journal logic." },
              { role: "Enterprise Architecture", specialist: "Technical Steering Board", domain: "Database Normalization", contribution: "Provides guidelines on ledger scale capabilities and immutable log structures." }
            ].map((adv, idx) => (
              <div 
                key={idx}
                className="lead-card-hover bg-[#050f21] border border-slate-900 rounded-3xl p-6 flex flex-col justify-between space-y-4 text-left text-xs"
              >
                <div className="space-y-2">
                  <span className="px-2 py-0.5 bg-slate-950 border border-slate-900 text-emerald-400 text-[9px] font-bold rounded">
                    {adv.role}
                  </span>
                  <h3 className="text-sm font-bold text-white">{adv.specialist}</h3>
                  <p className="text-[11px] text-slate-500 uppercase tracking-widest font-bold">{adv.domain}</p>
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px] pt-3 border-t border-slate-900/60">
                  {adv.contribution}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. CORE TEAM GRID */}
      <section className="py-24 px-5 sm:px-8 bg-slate-950/20 border-t border-slate-900 relative">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs text-cyan-400 font-bold uppercase tracking-widest">Platform Developers & Officers</span>
            <h2 className="text-3xl font-black text-white uppercase" style={{ fontFamily: "'Sora', sans-serif" }}>
              Core Technical Team
            </h2>
            <p className="text-slate-400 text-sm">
              The operational engineers keeping SARFIS responsive, compliant, and secure daily.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-8">
            {CORE_TEAM_MEMBERS.map((member, idx) => (
              <div 
                key={idx}
                className="lead-card-hover bg-[#050f21] border border-slate-900 rounded-3xl p-6 flex gap-4 items-start text-left"
              >
                <div className="w-11 h-11 rounded-xl bg-slate-950 border border-slate-900 flex items-center justify-center font-bold text-emerald-400 text-xs">
                  {member.initials}
                </div>
                <div className="flex-1 space-y-2.5">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h3 className="text-xs font-bold text-white">{member.name}</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">{member.role}</p>
                    </div>
                    <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-900/30 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider">
                      {member.dept}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed pt-2 border-t border-slate-900/60">
                    {member.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 10. WHY THIS TEAM */}
      <section className="py-24 px-5 sm:px-8 bg-[#030b1a] relative z-10 border-t border-slate-900">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs text-emerald-400 font-bold uppercase tracking-widest">Our Credibility</span>
            <h2 className="text-3xl font-black text-white uppercase" style={{ fontFamily: "'Sora', sans-serif" }}>
              Why Businesses Trust SARFIS
            </h2>
            <p className="text-slate-400 text-sm">
              We focus on compliance, architecture validation, and professional assistance so finance managers can perform audits confidently.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-8">
            {WHY_TRUST_US.map((item, idx) => (
              <div 
                key={idx}
                className="lead-card-hover bg-[#050f21] border border-slate-900 rounded-3xl p-6 space-y-3 text-left"
              >
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 size={15} />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">{item.title}</h3>
                </div>
                <p className="text-[11.5px] text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 11. LEADERSHIP VALUES */}
      <section className="py-24 px-5 sm:px-8 bg-slate-950/20 border-t border-slate-900 relative">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs text-cyan-400 font-bold uppercase tracking-widest">Our Pillars</span>
            <h2 className="text-3xl font-black text-white uppercase" style={{ fontFamily: "'Sora', sans-serif" }}>
              Leadership Values
            </h2>
            <p className="text-slate-400 text-sm">
              The operational rules and commitments we maintain across every module and line of code.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-8">
            {VALUES.map((val, idx) => {
              const Icon = val.icon;
              return (
                <div 
                  key={idx}
                  className="lead-card-hover bg-[#050f21] border border-slate-900 rounded-3xl p-6 text-left space-y-3.5"
                >
                  <div className="w-8 h-8 rounded-xl bg-slate-950 border border-slate-900 flex items-center justify-center text-cyan-400">
                    <Icon size={14} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">{val.title}</h3>
                    <p className="text-[10.5px] text-slate-400 leading-relaxed mt-1">{val.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 12. CALL TO ACTION */}
      <section className="py-28 px-5 sm:px-8 bg-[#030b1a] relative z-10 border-t border-slate-900 text-center overflow-hidden">
        {/* Soft background light */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full pointer-events-none opacity-20"
          style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 70%)', filter: 'blur(100px)' }} />

        <div className="max-w-3xl mx-auto relative z-10 space-y-8">
          <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight"
            style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
            Ready to work with a team building the future of enterprise finance?
          </h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto leading-relaxed">
            Configure a compliant, secure transaction workspace for your entities. Let our experts assist with data migrations and setups.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <a 
              href="/contact" 
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-8 py-3.5 rounded-xl transition-all shadow-lg active:scale-95 no-underline cursor-pointer border-none"
            >
              Schedule Demo
            </a>
            <a 
              href="/contact" 
              className="bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white text-xs font-bold px-8 py-3.5 rounded-xl transition border border-slate-800 active:scale-95 no-underline cursor-pointer"
            >
              Contact Sales
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </M.div>
  );
}
