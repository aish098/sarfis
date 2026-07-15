import { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

// Avatar component supporting passport-style rectangular photos with initials fallback
function ExecutiveAvatar({ initials, src, size = "w-28 h-36", borderAccent = "border-emerald-500", glowColor = "rgba(16,185,129,0.15)" }) {
  const [imageError, setImageError] = useState(false);

  return (
    <div 
      className={`relative flex items-center justify-center rounded-2xl bg-[#050f21] border-2 ${borderAccent} ${size} shadow-lg overflow-hidden transition-all duration-300 ease-out group-hover:border-white/40`}
      style={{
        boxShadow: `0 4px 12px rgba(0,0,0,0.1)`
      }}
    >
      {src && !imageError ? (
        <img 
          src={src} 
          alt={initials} 
          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]" 
          onError={() => setImageError(true)}
        />
      ) : (
        <span className="text-2xl font-bold text-white font-mono">{initials}</span>
      )}
      {/* Dynamic Glow Overlay matching section theme */}
      <div 
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          boxShadow: `inset 0 0 20px ${glowColor}, 0 0 20px ${glowColor}`
        }}
      />
    </div>
  );
}

// Performant statistics count-up animation component
function AnimatedCounter({ value, suffix = "" }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Detect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setCount(value);
      return;
    }

    if (!isInView) return;

    const num = parseInt(value, 10);
    if (isNaN(num)) {
      setCount(value);
      return;
    }

    const duration = 1500; // ms
    const startTime = performance.now();

    const animate = (timestamp) => {
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // easeOutExpo easing function
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      
      const current = Math.floor(easeProgress * num);
      setCount(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(num);
      }
    };

    requestAnimationFrame(animate);
  }, [isInView, value]);

  return <span ref={ref}>{count}{suffix}</span>;
}

// Simple left-to-right section divider reveal
function AnimatedDivider() {
  return (
    <div className="w-24 h-0.5 mx-auto my-4 bg-gradient-to-r from-emerald-500/10 via-emerald-500 to-emerald-500/10 rounded-full relative overflow-hidden">
      <motion.div
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        style={{ originX: 0.5 }}
        className="w-full h-full bg-emerald-400"
      />
    </div>
  );
}

export default function LeadershipPage() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  const handleMouseMove = (e) => {
    if (typeof window !== "undefined" && !prefersReducedMotion) {
      const { clientX, clientY } = e;
      const x = (clientX / window.innerWidth - 0.5) * 20; // max 10px dev
      const y = (clientY / window.innerHeight - 0.5) * 20;
      setMousePos({ x, y });
    }
  };

  // Distinct transitions config mapping
  const slideUpVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 35 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }
  };

  const scrollVariants = slideUpVariants;

  const slideLeftVariants = {
    hidden: { opacity: 0, x: prefersReducedMotion ? 0 : -35 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }
  };

  const slideRightVariants = {
    hidden: { opacity: 0, x: prefersReducedMotion ? 0 : 35 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }
  };

  const scaleCenterVariants = {
    hidden: { opacity: 0, scale: prefersReducedMotion ? 1 : 0.96 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] } }
  };

  const diagonalUpLeftVariants = {
    hidden: { opacity: 0, x: prefersReducedMotion ? 0 : -20, y: prefersReducedMotion ? 0 : 20 },
    visible: { opacity: 1, x: 0, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }
  };

  const diagonalUpRightVariants = {
    hidden: { opacity: 0, x: prefersReducedMotion ? 0 : 20, y: prefersReducedMotion ? 0 : 20 },
    visible: { opacity: 1, x: 0, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }
  };

  // Inject custom styles programmatically
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
      @keyframes lpFloatingGlow {
        0%, 100% { transform: translate(-15px, -15px); opacity: 0.15; }
        50% { transform: translate(15px, 15px); opacity: 0.30; }
      }
      .animate-floating-glow {
        animation: lpFloatingGlow 12s ease-in-out infinite;
      }
      @keyframes lpBounceSlow {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(8px); }
      }
      .animate-bounce-slow {
        animation: lpBounceSlow 2s ease-in-out infinite;
      }
      @keyframes lpParticleDrift {
        0%, 100% { transform: translate(0, 0); opacity: 0.2; }
        50% { transform: translate(15px, -15px); opacity: 0.5; }
      }
      .animate-particle-1 { animation: lpParticleDrift 15s ease-in-out infinite; }
      .animate-particle-2 { animation: lpParticleDrift 18s ease-in-out infinite; }
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
      transition={{ duration: 0.35 }}
      onMouseMove={handleMouseMove}
      className="bg-[#030b1a] min-h-screen text-white font-sans overflow-hidden relative"
    >
      <Navbar />

      {/* Floating Background Glow (Parallax) */}
      <div 
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0 hidden sm:block"
        style={{
          transform: `translate3d(${mousePos.x}px, ${mousePos.y}px, 0)`
        }}
      >
        <div className="w-[450px] h-[450px] bg-emerald-500/10 blur-[120px] rounded-full animate-floating-glow" />
      </div>

      {/* Tiny Background Particles */}
      <div className="absolute top-24 left-12 w-1.5 h-1.5 bg-emerald-500/30 rounded-full blur-[1px] animate-particle-1 pointer-events-none hidden sm:block" />
      <div className="absolute top-48 right-24 w-1 h-1 bg-cyan-500/40 rounded-full blur-[1px] animate-particle-2 pointer-events-none hidden sm:block" />
      <div className="absolute top-96 left-1/4 w-1.5 h-1.5 bg-emerald-400/20 rounded-full blur-[1px] animate-particle-1 pointer-events-none hidden sm:block" />

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
        
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight mb-3 flex flex-wrap justify-center gap-x-4 gap-y-2" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
          <motion.span
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="text-white"
          >
            Our
          </motion.span>
          <span className="relative inline-block overflow-hidden">
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Leadership
            </span>
            <motion.span
              initial={{ x: "0%" }}
              animate={{ x: "100%" }}
              transition={{ delay: 0.25, duration: 0.6, ease: "easeOut" }}
              className="absolute inset-y-0 left-0 right-0 bg-[#030b1a] z-10"
            />
          </span>
        </h1>

        {/* Animated Underline */}
        <motion.div 
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.6, duration: 0.6, ease: "easeOut" }}
          style={{ originX: 0.5 }}
          className="h-0.5 w-32 bg-gradient-to-r from-emerald-500 to-cyan-500 mx-auto mb-6"
        />

        <motion.p 
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-slate-400 text-base sm:text-lg leading-relaxed max-w-xl mx-auto"
        >
          Visionaries, academics, and strategic leaders steering the next generation of financial and operational resource planning.
        </motion.p>

        {/* Hero empty space filler statistics */}
        <motion.div 
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-12 max-w-2xl mx-auto grid grid-cols-3 gap-6 p-6 bg-slate-950/40 border border-slate-900 rounded-3xl backdrop-blur-sm shadow-xl"
        >
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
              <AnimatedCounter value="12" suffix="+" />
            </div>
            <div className="text-[10px] text-slate-500 uppercase font-bold mt-1 tracking-wider">Years Experience</div>
          </div>
          <div className="text-center border-x border-slate-850">
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              <AnimatedCounter value="4" />
            </div>
            <div className="text-[10px] text-slate-500 uppercase font-bold mt-1 tracking-wider">ERP Engines</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono">
              <AnimatedCounter value="50" suffix="+" />
            </div>
            <div className="text-[10px] text-slate-500 uppercase font-bold mt-1 tracking-wider">Corporate Clients</div>
          </div>
        </motion.div>

        {/* Scroll Indicator */}
        <div className="flex justify-center mt-12 animate-bounce-slow">
          <div className="text-slate-500 flex flex-col items-center gap-1 cursor-default">
            <span className="text-[9px] uppercase font-black tracking-widest">Scroll Down</span>
            <span className="text-sm font-black">↓</span>
          </div>
        </div>
      </section>

      {/* SECTION 1 — CEO & FOUNDER (Hero Profile Card) */}
      <motion.section 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={slideUpVariants}
        className="py-12 px-5 sm:px-8 max-w-5xl mx-auto"
      >
        {/* CEO Theme: Emerald Elite Glow on Hover */}
        <div className="group bg-[#050f21] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-6 sm:p-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-center cursor-default transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-emerald-500/30 hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.08)]">
          
          {/* Left Side: Portrait & Metrics */}
          <div className="md:col-span-5 flex flex-col items-center text-center space-y-6 md:border-r md:border-slate-800/80 md:pr-8">
            <div className="relative p-1.5 rounded-2xl border-2 border-emerald-500/80 transition-all duration-300 group-hover:border-emerald-450">
              <ExecutiveAvatar 
                initials="RZ" 
                src="/images/leadership/zain.jpg" 
                size="w-40 h-52" 
                borderAccent="border-emerald-500" 
                glowColor="rgba(16,185,129,0.2)"
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
                <div className="text-xl sm:text-2xl font-black text-white font-mono">
                  <AnimatedCounter value="12" suffix="+" />
                </div>
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Years</div>
              </div>
              <div className="text-center border-x border-slate-850">
                <div className="text-xl sm:text-2xl font-black text-white font-mono">
                  <AnimatedCounter value="4" />
                </div>
                <div className="text-[10px] text-slate-500 uppercase font-semibold">ERP Systems</div>
              </div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-black text-white font-mono">
                  <AnimatedCounter value="50" suffix="+" />
                </div>
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

            {/* Founder Quote */}
            <motion.div 
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="border-l-2 border-emerald-500 pl-4 py-1 italic text-slate-400 text-xs sm:text-sm font-medium"
            >
              "SARFIS is not just accounting software—it is an enterprise operating platform built for modern organizations."
            </motion.div>
          </div>

        </div>
      </motion.section>

      {/* SECTION 2 — Mentors & Academic Advisors */}
      <motion.section 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={slideUpVariants}
        className="py-16 px-5 sm:px-8 max-w-5xl mx-auto border-t border-slate-900"
      >
        <div className="text-center mb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-2xl sm:text-3xl font-black text-white" 
            style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
          >
            Mentors & Academic Advisors
          </motion.h2>
          <AnimatedDivider />
          <p className="text-slate-400 text-xs sm:text-sm max-w-xl mx-auto mt-2">
            Senior academics and industry professionals providing strategic, accounting, taxation and governance guidance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Card 1: Prof. Saad — Slides in from Left, Hover Cyan Glow */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            variants={slideLeftVariants}
            className="group bg-[#050f21] border border-slate-800 rounded-3xl p-6 flex flex-col justify-between space-y-6 shadow-xl cursor-default transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-cyan-500/30 hover:shadow-[0_20px_40px_-15px_rgba(6,182,212,0.08)] h-full"
          >
            <div className="space-y-4">
              <div className="flex gap-4 items-start flex-wrap sm:flex-nowrap">
                <ExecutiveAvatar 
                  initials="SM" 
                  src="/images/leadership/saad.jpg" 
                  size="w-28 h-36" 
                  borderAccent="border-emerald-500/60" 
                  glowColor="rgba(6,182,212,0.15)"
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
                <span className="text-base font-black text-white font-mono">
                  <AnimatedCounter value="15" suffix="+ Years" />
                </span>
              </div>
              <div>
                <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Projects</span>
                <span className="text-base font-black text-white font-mono">
                  <AnimatedCounter value="200" suffix="+" />
                </span>
              </div>
            </div>
          </motion.div>

          {/* Card 2: Prof. Rehan — Slides in from Right, Hover Cyan Glow */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            variants={slideRightVariants}
            className="group bg-[#050f21] border border-slate-800 rounded-3xl p-6 flex flex-col justify-between space-y-6 shadow-xl cursor-default transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-cyan-500/30 hover:shadow-[0_20px_40px_-15px_rgba(6,182,212,0.08)] h-full"
          >
            <div className="space-y-4">
              <div className="flex gap-4 items-start flex-wrap sm:flex-nowrap">
                <ExecutiveAvatar 
                  initials="RA" 
                  src="/images/leadership/rehan.jpg" 
                  size="w-28 h-36" 
                  borderAccent="border-emerald-500/60" 
                  glowColor="rgba(6,182,212,0.15)"
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
                <span className="text-base font-black text-white font-mono">
                  <AnimatedCounter value="18" suffix="+ Years" />
                </span>
              </div>
              <div>
                <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Projects</span>
                <span className="text-base font-black text-white font-mono">
                  <AnimatedCounter value="300" suffix="+" />
                </span>
              </div>
            </div>
          </motion.div>

        </div>
      </motion.section>

      {/* SECTION 3 — Strategic Management & Core Development */}
      <motion.section 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={slideUpVariants}
        className="py-16 px-5 sm:px-8 max-w-5xl mx-auto border-t border-slate-900"
      >
        <div className="text-center mb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-2xl sm:text-3xl font-black text-white" 
            style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
          >
            Strategic Management & Core Development Team
          </motion.h2>
          <AnimatedDivider />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Left Card: Ayesha — Slides Up-Right, Hover Violet Glow */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            variants={diagonalUpLeftVariants}
            className="group bg-[#050f21] border border-slate-800 rounded-3xl p-6 shadow-xl cursor-default transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-violet-500/30 hover:shadow-[0_20px_40px_-15px_rgba(139,92,246,0.08)] h-full flex flex-col"
          >
            <div className="flex gap-4 items-start">
              <ExecutiveAvatar 
                initials="AK" 
                src="/images/leadership/ayesha.jpg" 
                size="w-28 h-36" 
                borderAccent="border-emerald-500/60" 
                glowColor="rgba(139,92,246,0.15)"
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
            <div className="space-y-3 mt-6 flex-1 flex flex-col justify-between">
              <div>
                <span className="text-[9.5px] uppercase font-bold text-slate-500 block mb-1">Core Expertise</span>
                <div className="flex flex-wrap gap-1.5">
                  {["Enterprise ERP Architecture", "Full-Stack Software Engineering", "UI/UX & Product Experience", "Technical Strategy & Innovation", "Scalable System Design"].map(r => (
                    <span key={r} className="bg-slate-900 border border-slate-800 text-slate-400 text-[9.5px] px-2 py-0.5 rounded font-bold uppercase">{r}</span>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-850/80 mt-6">
                <span className="text-[9.5px] uppercase font-bold text-slate-500 block mb-1">Role Description</span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Specializes in enterprise software architecture, scalable application development, and user experience engineering. Focuses on designing secure, high-performance business systems, optimizing software quality, and driving innovation through modern technologies and best engineering practices.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Right Card: Syed Ansar — Slides Up-Left, Hover Violet Glow */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            variants={diagonalUpRightVariants}
            className="group bg-[#050f21] border border-slate-800 rounded-3xl p-6 shadow-xl cursor-default transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-violet-500/30 hover:shadow-[0_20px_40px_-15px_rgba(139,92,246,0.08)] h-full flex flex-col"
          >
            <div className="flex gap-4 items-start">
              <ExecutiveAvatar 
                initials="SA" 
                src="/images/leadership/ansar.jpg" 
                size="w-28 h-36" 
                borderAccent="border-emerald-500/60" 
                glowColor="rgba(139,92,246,0.15)"
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
            <div className="space-y-3 mt-6 flex-1 flex flex-col justify-between">
              <div>
                <span className="text-[9.5px] uppercase font-bold text-slate-500 block mb-1">Key Responsibilities</span>
                <div className="flex flex-wrap gap-1.5">
                  {["Cloud Infrastructure", "CI/CD", "Deployment", "Performance", "Security"].map(r => (
                    <span key={r} className="bg-slate-900 border border-slate-800 text-slate-400 text-[9.5px] px-2 py-0.5 rounded font-bold uppercase">{r}</span>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-850/80 mt-6">
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
        viewport={{ once: true, amount: 0.15 }}
        variants={scrollVariants}
        className="py-16 px-5 sm:px-8 max-w-5xl mx-auto border-t border-slate-900"
      >
        <div className="text-center mb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-2xl sm:text-3xl font-black text-white" 
            style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
          >
            Human Resources & Operations
          </motion.h2>
          <AnimatedDivider />
        </div>

        {/* HR Amna — Slides in from Left, Hover Amber Glow */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={slideLeftVariants}
          className="group bg-[#050f21] border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row gap-6 items-start shadow-xl cursor-default transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-amber-500/30 hover:shadow-[0_20px_40px_-15px_rgba(245,158,11,0.08)]"
        >
          <ExecutiveAvatar 
            initials="AA" 
            src="/images/leadership/amna.jpg" 
            size="w-28 h-36" 
            borderAccent="border-emerald-500/60" 
            glowColor="rgba(245,158,11,0.15)"
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
        viewport={{ once: true, amount: 0.15 }}
        variants={scrollVariants}
        className="py-16 px-5 sm:px-8 max-w-5xl mx-auto border-t border-slate-900"
      >
        <div className="text-center mb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-2xl sm:text-3xl font-black text-white" 
            style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
          >
            Finance & Business Intelligence
          </motion.h2>
          <AnimatedDivider />
        </div>

        {/* Finance Talal — Slides in from Right, Hover Gold Glow */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={slideRightVariants}
          className="group bg-[#050f21] border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row gap-6 items-start shadow-xl cursor-default transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-yellow-500/30 hover:shadow-[0_20px_40px_-15px_rgba(234,179,8,0.08)]"
        >
          <ExecutiveAvatar 
            initials="TK" 
            src="/images/leadership/talal.jpg" 
            size="w-28 h-36" 
            borderAccent="border-emerald-500/60" 
            glowColor="rgba(234,179,8,0.15)"
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
        viewport={{ once: true, amount: 0.15 }}
        variants={scrollVariants}
        className="py-16 px-5 sm:px-8 max-w-5xl mx-auto border-t border-slate-900"
      >
        <div className="text-center mb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-2xl sm:text-3xl font-black text-white" 
            style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
          >
            Legal Framework & Corporate Compliance
          </motion.h2>
          <AnimatedDivider />
        </div>

        {/* Legal Farhan — Scales from Center, Hover Emerald Glow */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={scaleCenterVariants}
          className="group bg-[#050f21] border border-emerald-500/20 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl shadow-emerald-500/2 cursor-default transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-emerald-400/40 hover:shadow-[0_20px_40px_-15px_rgba(52,211,153,0.08)]"
        >
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <ExecutiveAvatar 
              initials="FK" 
              src="/images/leadership/farhan.jpg" 
              size="w-32 h-40" 
              borderAccent="border-emerald-400" 
              glowColor="rgba(52,211,153,0.15)"
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

            {/* Legal Advisor Quote */}
            <motion.div 
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="border-l-2 border-emerald-500 pl-4 py-1 italic text-slate-400 text-xs sm:text-sm font-medium"
            >
              "Strong governance and compliance are the foundation of sustainable enterprise growth."
            </motion.div>
          </div>
        </motion.div>
      </motion.section>

      {/* SECTION 7 — Organizational Structure */}
      <motion.section 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={scrollVariants}
        className="py-16 px-5 sm:px-8 max-w-5xl mx-auto border-t border-slate-900"
      >
        <div className="text-center mb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-2xl sm:text-3xl font-black text-white" 
            style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
          >
            Organizational Structure
          </motion.h2>
          <AnimatedDivider />
        </div>

        {/* Visual Hierarchy Tree */}
        <div className="bg-[#050f21] border border-slate-800 rounded-3xl p-8 flex flex-col items-center transition-all duration-300 hover:border-slate-700/50">
          
          {/* Level 1: CEO */}
          <div className="flex flex-col items-center">
            <div className="bg-slate-950 border border-emerald-500/30 px-6 py-3 rounded-2xl text-center shadow-lg transition-all duration-300 hover:scale-[1.02] hover:border-emerald-400 cursor-default">
              <span className="text-[9.5px] text-emerald-400 font-bold uppercase tracking-wider block">CEO & Founder</span>
              <span className="text-xs font-black text-white block mt-0.5">Rana Muhammad Zain</span>
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
              <div className="bg-slate-950 border border-emerald-500/30 px-4 py-2.5 rounded-xl mt-1 transition-all duration-300 hover:scale-[1.02] hover:border-emerald-400 cursor-default">
                <span className="text-[9px] text-emerald-400 font-bold uppercase block">Core Track</span>
                <span className="text-[11px] font-bold text-white block">Development</span>
                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Ayesha Kashif</span>
              </div>
              
              <div className="w-0.5 h-6 bg-slate-800" />
              {/* DevOps */}
              <div className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl transition-all duration-300 hover:scale-[1.02] hover:border-emerald-500/35 cursor-default">
                <span className="text-[9px] text-slate-500 font-bold uppercase block">Infrastructure</span>
                <span className="text-[11px] font-bold text-white block">DevOps</span>
                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Syed Ansar Ali</span>
              </div>

              <div className="w-0.5 h-6 bg-slate-800" />
              {/* Legal Advisor */}
              <div className="bg-slate-950 border border-emerald-500/20 px-4 py-2.5 rounded-xl transition-all duration-300 hover:scale-[1.02] hover:border-emerald-400 cursor-default">
                <span className="text-[9px] text-emerald-400 font-bold uppercase block">Advisory</span>
                <span className="text-[11px] font-bold text-white block">Legal Advisor</span>
                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Farhan Ahmed Khokhar</span>
              </div>
            </div>

            {/* Column 2: Finance */}
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-6 bg-slate-800" />
              <div className="bg-slate-950 border border-emerald-500/20 px-4 py-2.5 rounded-xl mt-1 transition-all duration-300 hover:scale-[1.02] hover:border-emerald-400 cursor-default">
                <span className="text-[9px] text-emerald-400 font-bold uppercase block">Core Advisor</span>
                <span className="text-[11px] font-bold text-white block">Professor Saad Anwar Mughal</span>
              </div>
              
              <div className="w-0.5 h-6 bg-slate-800" />
              {/* Financial Analyst */}
              <div className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl transition-all duration-300 hover:scale-[1.02] hover:border-emerald-500/35 cursor-default">
                <span className="text-[9px] text-slate-500 font-bold uppercase block">Analysis</span>
                <span className="text-[11px] font-bold text-white block">Financial Analyst</span>
                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Rana Talal Khan</span>
              </div>
            </div>

            {/* Column 3: Operations */}
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-6 bg-slate-800" />
              <div className="bg-slate-950 border border-emerald-500/20 px-4 py-2.5 rounded-xl mt-1 transition-all duration-300 hover:scale-[1.02] hover:border-emerald-400 cursor-default">
                <span className="text-[9px] text-emerald-400 font-bold uppercase block">Core Advisor</span>
                <span className="text-[11px] font-bold text-white block">Professor Muhammad Rehan Anjum</span>
              </div>
              
              <div className="w-0.5 h-6 bg-slate-800" />
              {/* HR */}
              <div className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl transition-all duration-300 hover:scale-[1.02] hover:border-emerald-500/35 cursor-default">
                <span className="text-[9px] text-slate-500 font-bold uppercase block">Management</span>
                <span className="text-[11px] font-bold text-white block">HR</span>
                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Amna Waheed Ahmed</span>
              </div>
            </div>

          </div>
        </div>
      </motion.section>

      {/* SECTION 8 — Full Leadership Directory (Marquee Track) */}
      <motion.section 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={scrollVariants}
        className="py-16 border-t border-slate-900 overflow-hidden relative bg-[#040e1f]"
      >
        {/* Left & Right Fade gradients */}
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#040e1f] to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#040e1f] to-transparent z-10 pointer-events-none" />

        <div className="text-center mb-12 px-5 sm:px-8">
          <motion.h2 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-2xl sm:text-3xl font-black text-white" 
            style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
          >
            Full Leadership Directory
          </motion.h2>
          <AnimatedDivider />
        </div>

        <div className="relative w-full">
          <div className="animate-lp-marquee">
            {doubledDirectory.map((d, idx) => (
              <div
                key={idx}
                className="flex-shrink-0 flex items-center gap-4 px-6 py-4 bg-slate-950/40 border border-slate-800 rounded-2xl shadow-lg w-[320px] cursor-default transition-all duration-300 hover:border-emerald-500/30 hover:-translate-y-1"
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
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* SECTION 9 — Closing CTA */}
      <motion.section 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={scrollVariants}
        className="py-20 px-5 sm:px-8 text-center max-w-4xl mx-auto relative z-10 border-t border-slate-900"
      >
        <div className="bg-[#050f21] border border-slate-800 rounded-3xl p-8 sm:p-12 space-y-6 transition duration-300 hover:border-slate-700/60 shadow-2xl">
          <h2 className="text-2xl sm:text-4xl font-black text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
            Ready to build the future of enterprise intelligence?
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            <a 
              href="/contact" 
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-3 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10 active:scale-[0.97] cursor-pointer"
            >
              Request a Demo
            </a>
            <a 
              href="/contact" 
              className="bg-transparent border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white text-xs font-bold px-6 py-3 rounded-xl transition-all duration-300 active:scale-[0.97] cursor-pointer"
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
