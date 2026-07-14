import { useRef, useState, useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, TrendingUp, ShieldCheck, Cpu, BarChart3, Zap, ChevronLeft, ChevronRight } from 'lucide-react';

const floatingBadges = [
  { icon: TrendingUp, text: 'Revenue +24%', sub: 'vs last quarter', color: '#10b981' },
  { icon: ShieldCheck, text: 'AES-256 Encrypted', sub: 'Bank-grade security', color: '#06b6d4' },
  { icon: Cpu, text: 'AI Forecasting', sub: '94% accuracy rate', color: '#8b5cf6' },
];

const DASHBOARD_VIEWS = [
  {
    title: "SARFIS Analytics Dashboard",
    url: "app.SARFIS.io/dashboard/analytics",
    kpis: [
      { label: 'Total Revenue', value: '$284,920', change: '+18.4%', positive: true },
      { label: 'Net Profit', value: '$91,340', change: '+12.1%', positive: true },
      { label: 'Expenses', value: '$193,580', change: '-3.2%', positive: false },
      { label: 'Cash Flow', value: '$47,820', change: '+9.7%', positive: true },
    ],
    chartData: [40, 65, 45, 80, 55, 90, 70, 95, 75, 88, 60, 100],
    badgeColor: '#10b981'
  },
  {
    title: "AI Forecasting & Budgeting",
    url: "app.SARFIS.io/dashboard/forecasting",
    kpis: [
      { label: 'Projected Revenue', value: '$342,800', change: '+20.3%', positive: true },
      { label: 'Forecast Margin', value: '$112,400', change: '+15.6%', positive: true },
      { label: 'AI Accuracy', value: '94.2%', change: '+0.8%', positive: true },
      { label: 'Burn Rate', value: '$24,500', change: '-8.5%', positive: false },
    ],
    chartData: [50, 55, 62, 70, 68, 75, 83, 80, 89, 95, 92, 100],
    badgeColor: '#8b5cf6'
  },
  {
    title: "Inventory & Distribution",
    url: "app.SARFIS.io/dashboard/inventory",
    kpis: [
      { label: 'Stock Level', value: '45,280 Units', change: '+11.2%', positive: true },
      { label: 'Shipped Orders', value: '1,420', change: '+24.5%', positive: true },
      { label: 'Active Hubs', value: '12 Locations', change: 'Stable', positive: true },
      { label: 'Backorder Rate', value: '0.45%', change: '-12.3%', positive: false },
    ],
    chartData: [85, 78, 90, 82, 75, 88, 92, 85, 96, 90, 88, 94],
    badgeColor: '#06b6d4'
  }
];

export default function Hero() {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const [activeView, setActiveView] = useState(0);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.55; // Slower playback for an elegant background transition
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          // Catch autoplay or interruption rejections safely
          console.log("Background video playback handled:", error);
        });
      }
    }
  }, []);

  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end start'] });
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const contentY = useTransform(scrollYProgress, [0, 0.6], [0, -50]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);

  // Inject cinematic liquid glass and blur-fade-up styles programmatically
  if (typeof document !== 'undefined' && !document.getElementById('scafis-liquid-glass')) {
    const s = document.createElement('style');
    s.id = 'scafis-liquid-glass';
    s.textContent = `
      .liquid-glass {
        background: rgba(255, 255, 255, 0.015);
        background-blend-mode: luminosity;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.1);
        position: relative;
        overflow: hidden;
      }
      .liquid-glass::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        padding: 1.4px;
        background: linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.15) 80%, rgba(255,255,255,0.45) 100%);
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        pointer-events: none;
      }
      
      @keyframes blurFadeUp {
        0% { opacity: 0; filter: blur(20px); transform: translateY(40px); }
        100% { opacity: 1; filter: blur(0); transform: translateY(0); }
      }
      .animate-blur-fade-up {
        opacity: 0;
        animation: blurFadeUp 1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      }

      @keyframes kenBurns {
        0% { transform: scale(1.0); }
        100% { transform: scale(1.06); }
      }
      .animate-ken-burns {
        animation: kenBurns 35s ease-in-out infinite alternate;
      }

      @keyframes softPulse {
        0% { transform: translate(-50%, -50%) scale(1.0); opacity: 0.55; }
        100% { transform: translate(-50%, -50%) scale(1.12); opacity: 0.95; }
      }
      .animate-soft-pulse {
        animation: softPulse 20s ease-in-out infinite alternate;
      }
    `;
    document.head.appendChild(s);
  }

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-24 pb-20 bg-black"
    >
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <video
          ref={videoRef}
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260406_094145_4a271a6c-3869-4f1c-8aa7-aeb0cb227994.mp4"
          loop
          muted
          playsInline
          className="w-full h-full object-cover animate-ken-burns"
          style={{ filter: 'brightness(0.92) contrast(1.02)' }}
        />
        {/* Cinematic Vignette Overlay */}
        <div
          className="absolute inset-0 z-1 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 50% 50%, transparent 35%, rgba(3, 11, 26, 0.82) 100%)',
          }}
        />
        {/* SCAFIS Branding Overlay (radial gradient) */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 50% 50%, rgba(3, 11, 26, 0.08) 0%, rgba(3, 11, 26, 0.42) 100%)',
          }}
        />
        {/* Subtle Dot Matrix Micro Grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(rgba(110, 231, 183, 0.8) 1.2px, transparent 1.2px)',
            backgroundSize: '28px 28px',
          }}
        />
      </div>

      {/* Bottom Blur Overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          maskImage: 'linear-gradient(to top, black 0%, transparent 33%)',
          WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 33%)',
        }}
      />

      {/* Hero Content Wrapper */}
      <motion.div
        style={{ opacity: contentOpacity, y: contentY }}
        className="relative z-20 w-full max-w-6xl mx-auto px-5 sm:px-8 text-center flex flex-col justify-center h-full"
      >
        {/* Very Soft Emerald Glow */}
        <div 
          className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full pointer-events-none -z-10 animate-soft-pulse"
          style={{
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.04) 0%, transparent 70%)',
            filter: 'blur(160px)',
          }}
        />

        {/* Badge */}
        <div className="flex justify-center mb-8">
          <div
            className="animate-blur-fade-up liquid-glass inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider border border-emerald-500/20 text-[#6ee7b7]"
            style={{ animationDelay: '0ms' }}
          >
            <div className="animate-pulse">
              <Sparkles size={13} className="text-emerald-400" />
            </div>
            Trusted by 500+ businesses worldwide
          </div>
        </div>

        {/* Headline */}
        <h1
          className="animate-blur-fade-up text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.06] mb-5"
          style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif", animationDelay: '250ms' }}
        >
          Smarter Accounting,
          <br />
          <span
            className="text-transparent bg-clip-text"
            style={{ backgroundImage: 'linear-gradient(135deg, #10b981 0%, #06b6d4 60%, #10b981 100%)', backgroundSize: '200% 200%' }}
          >
            Powered by SARFIS
          </span>
        </h1>

        {/* Subline */}
        <p
          className="animate-blur-fade-up text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed font-normal"
          style={{ animationDelay: '400ms' }}
        >
          SARFIS automates your full accounting cycle journal entries, ledger, AI analytics, and
          forecasting so your team can focus on what matters most.
        </p>

        {/* Buttons */}
        <div
          className="animate-blur-fade-up flex flex-col sm:flex-row gap-4 justify-center mb-16"
          style={{ animationDelay: '500ms' }}
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
              className="liquid-glass inline-flex items-center gap-2.5 px-8 py-4 text-base font-medium text-white rounded-2xl hover:bg-white/5 transition-all duration-300 shadow-lg"
            >
              Sign In to Dashboard
            </Link>
          </motion.div>
        </div>

        {/* Metrics/Stats Row (Business KPI Metadata) */}
        <div
          className="animate-blur-fade-up flex flex-col sm:flex-row justify-center items-center gap-10 sm:gap-16 mb-20"
          style={{ animationDelay: '600ms' }}
        >
          {[
            { value: '10K+', label: 'Daily Transactions', icon: BarChart3, color: '#10b981' },
            { value: '500+', label: 'Businesses Onboarded', icon: ShieldCheck, color: '#06b6d4' },
            { value: '99.9%', label: 'Uptime Guarantee', icon: Zap, color: '#8b5cf6' }
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3.5 text-left group">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center liquid-glass transition-all duration-300 group-hover:scale-110"
                style={{ boxShadow: `0 8px 24px rgba(0,0,0,0.15)` }}
              >
                <s.icon size={18} style={{ color: s.color }} />
              </div>
              <div>
                <div className="text-3xl font-black text-white leading-none mb-0.5" style={{ fontFamily: "'Sora', monospace" }}>{s.value}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Floating dashboard mockup with Multi-View Controller */}
        <motion.div
          initial={{ opacity: 0, y: 80, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.1, delay: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative max-w-4xl mx-auto w-full"
        >
          {/* Dynamic Glow behind image */}
          <div
            className="absolute -inset-8 rounded-3xl opacity-25 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse, ${DASHBOARD_VIEWS[activeView].badgeColor} 0%, transparent 70%)`,
              filter: 'blur(40px)',
              transition: 'background 0.5s ease'
            }}
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
              style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(10px)' }}
            >
              {/* Titlebar */}
              <div
                className="flex items-center gap-3 px-5 py-3.5 border-b"
                style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <div className="flex gap-1.5 font-sans">
                  <div className="w-3 h-3 rounded-full bg-red-400/50" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400/50" />
                  <div className="w-3 h-3 rounded-full bg-green-400/50" />
                </div>
                <div
                  className="flex-1 mx-4 bg-white/[0.05] rounded-md px-3 py-1.5 text-xs text-slate-500 text-left font-mono"
                >
                  {DASHBOARD_VIEWS[activeView].url}
                </div>
              </div>

              {/* Dashboard content */}
              <div className="p-6" style={{ background: 'linear-gradient(180deg, #0d1829 0%, #06101e 100%)' }}>
                {/* KPI cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5 font-sans">
                  {DASHBOARD_VIEWS[activeView].kpis.map((kpi, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl border text-left"
                      style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}
                    >
                      <div className="text-[10px] text-slate-500 mb-1.5 font-medium uppercase tracking-wider">{kpi.label}</div>
                      <div className="text-lg font-black text-white mb-1" style={{ fontFamily: "'Sora', monospace" }}>{kpi.value}</div>
                      <div className={`text-[11px] font-semibold ${kpi.positive ? 'text-emerald-400' : 'text-rose-400'}`}>{kpi.change}</div>
                    </div>
                  ))}
                </div>

                {/* Chart placeholder */}
                <div
                  className="rounded-xl border p-5 flex items-end gap-1.5 h-32"
                  style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}
                >
                  {DASHBOARD_VIEWS[activeView].chartData.map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                      className="flex-1 rounded-t-sm"
                      style={{
                        background: i === 11
                          ? `linear-gradient(180deg, ${DASHBOARD_VIEWS[activeView].badgeColor}, ${DASHBOARD_VIEWS[activeView].badgeColor}cc)`
                          : `${DASHBOARD_VIEWS[activeView].badgeColor}${Math.floor(0.15 * 255).toString(16)}`,
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
                  <div className="text-left">
                    <div className="text-white text-[13px] font-semibold leading-none mb-0.5">{badge.text}</div>
                    <div className="text-slate-500 text-[11px]">{badge.sub}</div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Cinematic Interactive Dashboard Switcher Controls */}
          <div className="flex items-center gap-4 mt-8 justify-center z-30 relative animate-blur-fade-up" style={{ animationDelay: '750ms' }}>
            <button
              onClick={() => setActiveView((prev) => (prev === 0 ? DASHBOARD_VIEWS.length - 1 : prev - 1))}
              className="liquid-glass w-11 h-11 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-lg cursor-pointer hover:scale-105 active:scale-95 border-none"
              title="Previous Module View"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex flex-col items-center">
              <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase mb-1">
                Active Module {activeView + 1} of {DASHBOARD_VIEWS.length}
              </span>
              <span className="text-sm font-semibold text-white tracking-tight">
                {DASHBOARD_VIEWS[activeView].title}
              </span>
            </div>

            <button
              onClick={() => setActiveView((prev) => (prev === DASHBOARD_VIEWS.length - 1 ? 0 : prev + 1))}
              className="liquid-glass w-11 h-11 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-lg cursor-pointer hover:scale-105 active:scale-95 border-none"
              title="Next Module View"
            >
              <ChevronRight size={18} />
            </button>
          </div>

        </motion.div>
      </motion.div>
    </section>
  );
}
