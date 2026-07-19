import { useState, useEffect, useRef } from 'react';
import { motion, useInView, MotionConfig } from 'framer-motion';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

// Define Framer Motion variants statically to avoid mount evaluation delays
const slideUpVariants = {
  hidden: { opacity: 0, y: 35 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }
};

const scrollVariants = slideUpVariants;

const slideLeftVariants = {
  hidden: { opacity: 0, x: -35 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }
};

const slideRightVariants = {
  hidden: { opacity: 0, x: 35 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }
};

const scaleCenterVariants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] } }
};

const diagonalUpLeftVariants = {
  hidden: { opacity: 0, x: -20, y: 20 },
  visible: { opacity: 1, x: 0, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }
};

const diagonalUpRightVariants = {
  hidden: { opacity: 0, x: 20, y: 20 },
  visible: { opacity: 1, x: 0, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }
};

// Avatar component supporting circular photos with initials fallback and a thin gradient ring
function ExecutiveAvatar({ initials, src, size = "w-36 h-36", borderAccent = "border-emerald-500", glowColor = "rgba(16,185,129,0.15)", objectPosition = "center", imageScale = 1 }) {
  const [imageError, setImageError] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Map borderAccent to clean gradient color combinations for the outer ring
  let gradientClass = "from-emerald-500 to-cyan-500";
  if (borderAccent.includes("cyan")) gradientClass = "from-cyan-500 to-blue-500";
  if (borderAccent.includes("amber")) gradientClass = "from-amber-500 to-orange-500";
  if (borderAccent.includes("purple") || borderAccent.includes("violet")) gradientClass = "from-violet-500 to-fuchsia-500";
  if (borderAccent.includes("slate")) gradientClass = "from-slate-600 to-slate-400";

  return (
    <div 
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative flex items-center justify-center p-[2px] rounded-full bg-gradient-to-tr ${gradientClass} ${size} shadow-lg transition-all duration-300 ease-out`}
      style={{
        boxShadow: hovered ? `0 10px 25px -5px ${glowColor}, 0 0 20px ${glowColor}` : '0 4px 12px rgba(0,0,0,0.15)',
        transform: hovered ? "scale(1.05)" : "scale(1)"
      }}
    >
      <div 
        className="w-full h-full relative flex items-center justify-center bg-[#050f21] rounded-full overflow-hidden"
      >
        {src && !imageError ? (
          <div className="relative w-full h-full">
            <img 
              src={src} 
              alt="Profile" 
              draggable="false"
              className="w-full h-full object-cover pointer-events-none transition-transform duration-500 ease-out origin-center"
              style={{ 
                objectPosition,
                transform: hovered ? `scale(${imageScale * 1.1})` : `scale(${imageScale})`
              }}
              onError={() => setImageError(true)}
            />
            {/* Transparent protective shield overlay to disable right-click and save */}
            <div 
              className="absolute inset-0 z-10 bg-transparent cursor-default"
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
        ) : (
          <span className="text-xl font-bold text-white font-mono">{initials}</span>
        )}
        {/* Dynamic Glow Overlay matching section theme */}
        <div 
          className={`absolute inset-0 transition-opacity duration-300 pointer-events-none rounded-full ${hovered ? 'opacity-100' : 'opacity-0'}`}
          style={{
            boxShadow: `inset 0 0 20px ${glowColor}`
          }}
        />
      </div>
    </div>
  );
}

// Performant statistics count-up animation component
function AnimatedCounter({ value, suffix = "" }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [count, setCount] = useState(0);

  useEffect(() => {
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
    <MotionConfig transition={prefersReducedMotion ? { duration: 0 } : undefined}>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -16, scale: 0.99 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
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
              initial={{ opacity: 0, y: 20 }}
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-slate-400 text-base sm:text-lg leading-relaxed max-w-xl mx-auto"
          >
            Visionaries, academics, and strategic leaders steering the next generation of financial and operational resource planning.
          </motion.p>

          {/* Scroll Indicator */}
          <div className="flex justify-center mt-12 animate-bounce-slow">
            <div className="text-slate-500 flex flex-col items-center gap-1 cursor-default">
              <span className="text-[9px] uppercase font-black tracking-widest">Scroll Down</span>
              <span className="text-sm font-black">↓</span>
            </div>
          </div>
        </section>

        {/* SECTION 1 — CEO & FOUNDER (Hero Profile Card) */}
        <section className="py-12 px-5 sm:px-8 max-w-xl mx-auto">
          {/* CEO Theme: Emerald Elite Glow on Hover */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            variants={slideUpVariants}
            className="group bg-[#050f21] border border-slate-800 rounded-3xl p-8 flex flex-col items-center text-center space-y-6 shadow-2xl cursor-default transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-emerald-500/30 hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.08)] w-full"
          >
            <ExecutiveAvatar 
              initials="RZ" 
              src="/images/leadership/zain.jpg" 
              size="w-48 h-48" 
              borderAccent="border-emerald-500" 
              glowColor="rgba(16,185,129,0.2)"
              objectPosition="center 15%"
            />
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Rana Muhammad Zain Ul Abideen</h2>
              <div className="mt-3">
                <span className="inline-block px-4 py-1.5 bg-emerald-950/40 border border-emerald-500/20 rounded-full text-xs font-black text-emerald-400 uppercase tracking-widest">
                  Chief Executive Officer & Founder
                </span>
              </div>
            </div>
          </motion.div>
        </section>

        {/* SECTION 2 — Mentors & Academic Advisors */}
        <section className="py-16 px-5 sm:px-8 max-w-5xl mx-auto border-t border-slate-900">
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
              className="group bg-[#050f21] border border-slate-800 rounded-3xl p-6 flex flex-col space-y-6 shadow-xl cursor-default transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-cyan-500/30 hover:shadow-[0_20px_40px_-15px_rgba(6,182,212,0.08)] h-full w-full"
            >
              <div className="space-y-6">
                {/* Centered Avatar and Name */}
                <div className="flex flex-col items-center text-center">
                  <ExecutiveAvatar 
                    initials="SM" 
                    src="/images/leadership/saad.jpg" 
                    size="w-44 h-44" 
                    borderAccent="border-emerald-500/60" 
                    glowColor="rgba(6,182,212,0.15)"
                    objectPosition="center 15%"
                  />
                  <h3 className="text-xl sm:text-2xl font-extrabold text-white mt-4" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
                    Professor Saad Anwar Mughal
                  </h3>
                </div>

                {/* Highlights as Green Capsules (2 per row) */}
                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  {[
                    "Tax & Corporate Law Advisor",
                    "Author (Tax & Sales)",
                    "Lecturer",
                    "Trainer of Law & Taxation"
                  ].map((item, idx) => (
                    <span 
                      key={idx} 
                      className="inline-flex items-center justify-center text-center px-2 py-1.5 bg-emerald-950/40 border border-emerald-500/20 rounded-full text-[9px] font-black text-emerald-400 uppercase tracking-widest leading-normal"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* Centered Metrics */}
              <div className="pt-4 border-t border-slate-850 text-xs w-full">
                <div className="text-center">
                  <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Experience</span>
                  <span className="text-base font-black text-white font-mono">
                    <AnimatedCounter value="18" suffix=" Years" />
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
              className="group bg-[#050f21] border border-slate-800 rounded-3xl p-6 flex flex-col space-y-6 shadow-xl cursor-default transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-cyan-500/30 hover:shadow-[0_20px_40px_-15px_rgba(6,182,212,0.08)] h-full w-full"
            >
              <div className="space-y-6">
                {/* Centered Avatar and Name */}
                <div className="flex flex-col items-center text-center">
                  <ExecutiveAvatar 
                    initials="RA" 
                    src="/images/leadership/rehan.jpeg" 
                    size="w-44 h-44" 
                    borderAccent="border-emerald-500/60" 
                    glowColor="rgba(6,182,212,0.15)"
                    objectPosition="center 15%"
                    imageScale={0.9}
                  />
                  <h3 className="text-xl sm:text-2xl font-extrabold text-white mt-4" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
                    Professor Muhammad Rehan Anjum
                  </h3>
                </div>

                {/* Highlights as Green Capsules (2 per row) */}
                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  {[
                    "Lecturer",
                    "ACCA Member"
                  ].map((item, idx) => (
                    <span 
                      key={idx} 
                      className="inline-flex items-center justify-center text-center px-2 py-1.5 bg-emerald-950/40 border border-emerald-500/20 rounded-full text-[9px] font-black text-emerald-400 uppercase tracking-widest leading-normal"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* Centered Metrics */}
              <div className="pt-4 border-t border-slate-850 text-xs w-full">
                <div className="text-center">
                  <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Experience</span>
                  <span className="text-base font-black text-white font-mono">
                    <AnimatedCounter value="20" suffix=" Years" />
                  </span>
                </div>
              </div>
            </motion.div>

          </div>
        </section>

        {/* SECTION 3 — Core Team Members */}
        <section className="py-16 px-5 sm:px-8 max-w-5xl mx-auto border-t border-slate-900">
          <div className="text-center mb-12">
            <motion.h2 
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-2xl sm:text-3xl font-black text-white" 
              style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
            >
              Core Team Members
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
              className="group bg-[#050f21] border border-slate-800 rounded-3xl p-6 shadow-xl cursor-default transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-violet-500/30 hover:shadow-[0_20px_40px_-15px_rgba(139,92,246,0.08)] h-full w-full flex flex-col space-y-6"
            >
              <div className="flex gap-4 items-center">
                <ExecutiveAvatar 
                  initials="AK" 
                  src="/images/leadership/ayesha1.png" 
                  size="w-36 h-36" 
                  borderAccent="border-emerald-500/60" 
                  glowColor="rgba(139,92,246,0.15)"
                />
                <div className="flex-1">
                  <h3 className="text-lg sm:text-xl font-extrabold text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Ayesha Kashif</h3>
                  <div className="mt-1">
                    <span className="inline-block px-3 py-1 bg-emerald-950/40 border border-emerald-500/20 rounded-full text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                      Lead Developer & Co-Founder
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Card: Amna — Slides Up-Left, Hover Amber Glow */}
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.15 }}
              variants={diagonalUpRightVariants}
              className="group bg-[#050f21] border border-slate-800 rounded-3xl p-6 shadow-xl cursor-default transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-amber-500/30 hover:shadow-[0_20px_40px_-15px_rgba(245,158,11,0.08)] h-full w-full flex flex-col space-y-6"
            >
              <div className="flex gap-4 items-center">
                <ExecutiveAvatar 
                  initials="AA" 
                  src="/images/leadership/amna.png" 
                  size="w-36 h-36" 
                  borderAccent="border-emerald-500/60" 
                  glowColor="rgba(245,158,11,0.15)"
                />
                <div className="flex-1">
                  <h3 className="text-lg sm:text-xl font-extrabold text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Amna Waheed Ahmed</h3>
                  <div className="mt-1">
                    <span className="inline-block px-3 py-1 bg-emerald-950/40 border border-emerald-500/20 rounded-full text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                      Human Resources Executive
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </section>

        {/* SECTION 4 — DevOps, Finance & Operations */}
        <section className="py-16 px-5 sm:px-8 max-w-5xl mx-auto border-t border-slate-900">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Left Card: DevOps Ansar — Slides Up-Right, Hover Violet Glow */}
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.15 }}
              variants={diagonalUpLeftVariants}
              className="group bg-[#050f21] border border-slate-800 rounded-3xl p-6 shadow-xl cursor-default transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-violet-500/30 hover:shadow-[0_20px_40px_-15px_rgba(139,92,246,0.08)] h-full w-full flex flex-col space-y-6"
            >
              <div className="flex gap-4 items-center">
                <ExecutiveAvatar 
                  initials="SA" 
                  src="/images/leadership/ansar.jpg" 
                  size="w-36 h-36" 
                  borderAccent="border-emerald-500/60" 
                  glowColor="rgba(139,92,246,0.15)"
                />
                <div className="flex-1">
                  <h3 className="text-lg sm:text-xl font-extrabold text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Syed Ansar Ali</h3>
                  <div className="mt-1">
                    <span className="inline-block px-3 py-1 bg-emerald-950/40 border border-emerald-500/20 rounded-full text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                      DevOps Engineer
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Card: Finance Talal — Slides Up-Left, Hover Gold Glow */}
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.15 }}
              variants={diagonalUpRightVariants}
              className="group bg-[#050f21] border border-slate-800 rounded-3xl p-6 shadow-xl cursor-default transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-yellow-500/30 hover:shadow-[0_20px_40px_-15px_rgba(234,179,8,0.08)] h-full w-full flex flex-col space-y-6"
            >
              <div className="flex gap-4 items-center">
                <ExecutiveAvatar 
                  initials="TK" 
                  src="/images/leadership/talal.jpg" 
                  size="w-36 h-36" 
                  borderAccent="border-emerald-500/60" 
                  glowColor="rgba(234,179,8,0.15)"
                />
                <div className="flex-1">
                  <h3 className="text-lg sm:text-xl font-extrabold text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Rana Talal Khan</h3>
                  <div className="mt-1">
                    <span className="inline-block px-3 py-1 bg-emerald-950/40 border border-emerald-500/20 rounded-full text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                      Financial Analyst
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </section>

        {/* SECTION 6 — Legal Framework & Corporate Compliance */}
        <section className="py-16 px-5 sm:px-8 max-w-5xl mx-auto border-t border-slate-900">
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
            className="group bg-[#050f21] border border-emerald-500/20 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl shadow-emerald-500/2 cursor-default transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-emerald-400/40 hover:shadow-[0_20px_40px_-15px_rgba(52,211,153,0.08)] w-full"
          >
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <ExecutiveAvatar 
                initials="FK" 
                src="/images/leadership/farhan.jpg" 
                size="w-36 h-36" 
                borderAccent="border-emerald-400" 
                glowColor="rgba(52,211,153,0.15)"
                objectPosition="top"
              />
              <div className="flex-1 space-y-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-block px-4 py-1.5 bg-emerald-950/40 border border-emerald-500/20 rounded-full text-lg sm:text-xl font-extrabold text-white normal-case">
                      Farhan Ahmed Khokhar
                    </span>
                  </div>
                </div>

                {/* Highlights Bullet Points */}
                <ul className="space-y-1.5 text-xs text-slate-400 pt-2">
                  {[
                    "Legal Advisor",
                    "Advocate High Court",
                    "Tax & Corporate Law Advisor"
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 opacity-80" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                {/* Metrics */}
                <div className="pt-4 border-t border-slate-850 text-xs w-full max-w-xs">
                  <div>
                    <span className="text-[9.5px] uppercase font-bold text-slate-500 block">Experience</span>
                    <span className="text-base font-black text-white font-mono">
                      <AnimatedCounter value="11" suffix=" Years" />
                    </span>
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        </section>

        {/* SECTION 7 — Organizational Structure */}
        <section className="py-16 px-5 sm:px-8 max-w-5xl mx-auto border-t border-slate-900">
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

          {/* Visual Hierarchy Tree Wrapper */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            variants={scrollVariants}
            className="bg-[#050f21] border border-slate-800 rounded-3xl p-8 flex flex-col items-center transition-all duration-300 hover:border-slate-700/50"
          >
            
            {/* Level 1: CEO */}
            <div className="flex flex-col items-center">
              <div className="bg-slate-950 border border-emerald-500/30 px-6 py-3 rounded-2xl text-center shadow-lg transition-all duration-300 hover:scale-[1.02] hover:border-emerald-400 cursor-default">
                <span className="text-[9.5px] text-emerald-400 font-bold uppercase tracking-wider block">CEO & Founder</span>
                <span className="text-xs font-black text-white block mt-0.5">Rana Muhammad Zain</span>
              </div>
              
              {/* Vertical Line */}
              <div className="w-0.5 h-8 bg-slate-800 hidden md:block" />
            </div>

            {/* Horizontal Connector bar */}
            <div className="w-[80%] max-w-3xl items-center relative hidden md:flex">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-slate-800" />
            </div>

            {/* Level 2 drops */}
            <div className="w-full max-w-3xl flex flex-col md:grid md:grid-cols-3 gap-6 md:gap-0 text-center">
              
              {/* Column 1: Left - Saad -> Amna -> Talal */}
              <div className="flex flex-col items-center">
                <div className="w-0.5 h-6 bg-slate-800 hidden md:block" />
                {/* Professor Saad */}
                <div className="bg-slate-950 border border-emerald-500/30 px-4 py-2.5 rounded-xl mt-1 transition-all duration-300 hover:scale-[1.02] hover:border-emerald-400 cursor-default">
                  <span className="text-[9px] text-emerald-400 font-bold uppercase block">Core Advisor</span>
                  <span className="text-[11px] font-bold text-white block">Professor Saad Anwar Mughal</span>
                </div>
                
                <div className="w-0.5 h-6 bg-slate-800 hidden md:block" />
                {/* Amna */}
                <div className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl transition-all duration-300 hover:scale-[1.02] hover:border-emerald-500/35 cursor-default">
                  <span className="text-[9px] text-slate-500 font-bold uppercase block">Management</span>
                  <span className="text-[11px] font-bold text-white block">Human Resources Executive</span>
                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Amna Waheed Ahmed</span>
                </div>

                <div className="w-0.5 h-6 bg-slate-800 hidden md:block" />
                {/* Rana Talal Khan */}
                <div className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl transition-all duration-300 hover:scale-[1.02] hover:border-emerald-500/35 cursor-default">
                  <span className="text-[9px] text-slate-500 font-bold uppercase block">Analysis</span>
                  <span className="text-[11px] font-bold text-white block">Financial Analyst</span>
                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Rana Talal Khan</span>
                </div>
              </div>

              {/* Column 2: Center - Farhan */}
              <div className="flex flex-col items-center">
                <div className="w-0.5 h-6 bg-slate-800 hidden md:block" />
                {/* Legal Advisor Farhan */}
                <div className="bg-slate-950 border border-emerald-500/20 px-4 py-2.5 rounded-xl mt-1 transition-all duration-300 hover:scale-[1.02] hover:border-emerald-400 cursor-default">
                  <span className="text-[9px] text-emerald-400 font-bold uppercase block">Advisory</span>
                  <span className="text-[11px] font-bold text-white block">Legal Advisor</span>
                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Farhan Ahmed Khokhar</span>
                </div>
              </div>

              {/* Column 3: Right - Rehan -> Ayesha -> Ansar */}
              <div className="flex flex-col items-center">
                <div className="w-0.5 h-6 bg-slate-800 hidden md:block" />
                {/* Professor Rehan */}
                <div className="bg-slate-950 border border-emerald-500/30 px-4 py-2.5 rounded-xl mt-1 transition-all duration-300 hover:scale-[1.02] hover:border-emerald-400 cursor-default">
                  <span className="text-[9px] text-emerald-400 font-bold uppercase block">Core Advisor</span>
                  <span className="text-[11px] font-bold text-white block">Professor Muhammad Rehan Anjum</span>
                </div>
                
                <div className="w-0.5 h-6 bg-slate-800 hidden md:block" />
                {/* Ayesha */}
                <div className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl transition-all duration-300 hover:scale-[1.02] hover:border-emerald-500/35 cursor-default">
                  <span className="text-[9px] text-slate-500 font-bold uppercase block">Core Track</span>
                  <span className="text-[11px] font-bold text-white block">Lead Developer</span>
                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Ayesha Kashif</span>
                </div>

                <div className="w-0.5 h-6 bg-slate-800 hidden md:block" />
                {/* Syed Ansar Ali */}
                <div className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl transition-all duration-300 hover:scale-[1.02] hover:border-emerald-500/35 cursor-default">
                  <span className="text-[9px] text-slate-500 font-bold uppercase block">Infrastructure</span>
                  <span className="text-[11px] font-bold text-white block">DevOps Engineer</span>
                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Syed Ansar Ali</span>
                </div>
              </div>

            </div>
          </motion.div>
        </section>

        {/* SECTION 8 — Full Leadership Directory (Marquee Track) */}
        <section className="py-16 border-t border-slate-900 overflow-hidden relative bg-[#040e1f]">
          {/* Left & Right Fade gradients */}
          <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#040e1f] to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#040e1f] to-transparent z-10 pointer-events-none" />

          {/* Directory Title + Marquee Wrapper */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            variants={scrollVariants}
          >
            <div className="text-center mb-12 px-5 sm:px-8">
              <h2 className="text-2xl sm:text-3xl font-black text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
                Full Leadership Directory
              </h2>
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
          </motion.div>
        </section>

        {/* SECTION 9 — Closing CTA */}
        <section className="py-20 px-5 sm:px-8 text-center max-w-4xl mx-auto relative z-10 border-t border-slate-900">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            variants={scrollVariants}
            className="bg-[#050f21] border border-slate-800 rounded-3xl p-8 sm:p-12 space-y-6 transition duration-300 hover:border-slate-700/60 shadow-2xl"
          >
            <h2 className="text-2xl sm:text-4xl font-black text-white" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
              Ready to build the future of enterprise intelligence?
            </h2>
            <div className="flex flex-wrap justify-center gap-4">
              <a 
                href="/tutorial" 
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
          </motion.div>
        </section>

        <Footer />
      </motion.div>
    </MotionConfig>
  );
}
