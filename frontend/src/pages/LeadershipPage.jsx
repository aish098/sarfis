/**
 * LeadershipPage.jsx  —  SCAFIS Premium Leadership
 *
 * Sections:
 *  1. Hero  — full-width with animated particle canvas + parallax
 *  2. Leadership Hierarchy — editorial sidebar layout
 *  3. Mentors & Advisors — dark cards with glow
 *  4. CEO Spotlight — split panel
 *  5. Team Marquee — infinite auto-scroll with hover pause
 *
 * Color System (strictly followed):
 *   #1a1f2e  main bg
 *   #12162a  card bg
 *   #2a3044  borders
 *   #6366f1 / #4f46e5  accent indigo
 *   #f1f5f9  text primary
 *   #94a3b8  text muted
 *
 * Fonts: Syne (display) + DM Sans (body) — injected via Google Fonts
 * Requires: framer-motion (already in project)
 */

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

/* ═══════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════ */
const C = {
  bg:       "#1a1f2e",
  card:     "#12162a",
  cardDeep: "#0b0e1a",
  border:   "#2a3044",
  borderLo: "#1a1f2e",
  accent:   "#6366f1",
  accentDk: "#4f46e5",
  accentLt: "#818cf8",
  accentGl: "rgba(99,102,241,0.14)",
  accentG2: "rgba(99,102,241,0.07)",
  violet:   "#a78bfa",
  textPri:  "#f1f5f9",
  textSec:  "#94a3b8",
  textDim:  "#475569",
};

/* ═══════════════════════════════════════════════════════════
   FONT INJECTION
═══════════════════════════════════════════════════════════ */
if (typeof document !== "undefined" && !document.getElementById("lp-syne")) {
  const l = document.createElement("link");
  l.id = "lp-syne"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap";
  document.head.appendChild(l);
}

const f = {
  display: { fontFamily: "'Syne', sans-serif" },
  body:    { fontFamily: "'DM Sans', sans-serif" },
  mono:    { fontFamily: "'JetBrains Mono', monospace" },
};

/* ═══════════════════════════════════════════════════════════
   CSS KEYFRAMES (injected once)
═══════════════════════════════════════════════════════════ */
if (typeof document !== "undefined" && !document.getElementById("lp-css")) {
  const s = document.createElement("style");
  s.id = "lp-css";
  s.textContent = `
    @keyframes marquee {
      0%   { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    @keyframes float-slow {
      0%, 100% { transform: translateY(0px) rotate(0deg); }
      50%       { transform: translateY(-12px) rotate(1deg); }
    }
    @keyframes pulse-ring {
      0%   { box-shadow: 0 0 0 0 rgba(99,102,241,0.35); }
      70%  { box-shadow: 0 0 0 14px rgba(99,102,241,0); }
      100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
    }
    .marquee-track { animation: marquee 32s linear infinite; }
    .marquee-track:hover { animation-play-state: paused; }
    .float-card { animation: float-slow 6s ease-in-out infinite; }
    .pulse-avatar { animation: pulse-ring 2.5s ease-out infinite; }
  `;
  document.head.appendChild(s);
}

/* ═══════════════════════════════════════════════════════════
   SCROLL REVEAL
═══════════════════════════════════════════════════════════ */
const fadeUp    = { hidden: { opacity: 0, y: 36 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22,1,0.36,1] } } };
const fadeLeft  = { hidden: { opacity: 0, x: -40 }, show: { opacity: 1, x: 0, transition: { duration: 0.65, ease: [0.22,1,0.36,1] } } };
const stagger   = { show: { transition: { staggerChildren: 0.1 } } };

function Reveal({ children, variants = fadeUp, delay = 0, style = {}, className = "" }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.12 }}
      variants={variants}
      transition={{ delay }}
      style={style}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PARTICLE CANVAS
═══════════════════════════════════════════════════════════ */
function ParticleCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf, W, H;

    const COLORS = ["rgba(99,102,241,0.6)", "rgba(129,140,248,0.5)", "rgba(167,139,250,0.4)", "rgba(34,211,238,0.3)"];
    let particles = [];

    function resize() {
      W = canvas.width  = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    }

    function spawn() {
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.8 + 0.4,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: Math.random() * 0.8 + 0.2,
        life: 0,
        maxLife: 180 + Math.random() * 240,
      };
    }

    function init() { particles = Array.from({ length: 90 }, spawn); }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 100) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(99,102,241,${0.08 * (1 - d / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      particles.forEach((p, idx) => {
        p.x += p.vx; p.y += p.vy; p.life++;
        if (p.x < 0 || p.x > W || p.y < 0 || p.y > H || p.life > p.maxLife) {
          particles[idx] = spawn();
          return;
        }
        const fade = p.life < 30 ? p.life / 30 : p.life > p.maxLife - 30 ? (p.maxLife - p.life) / 30 : 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color.replace(/[\d.]+\)$/, `${p.alpha * fade})`);
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    }

    resize();
    init();
    draw();
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════
   AVATAR
═══════════════════════════════════════════════════════════ */
function Avatar({ initials, size = 72, accent = C.accent, pulse = false, img = null }) {
  return (
    <div
      className={pulse ? "pulse-avatar" : ""}
      style={{
        width: size, height: size, borderRadius: "50%",
        background: img ? undefined : `radial-gradient(circle at 38% 38%, #252d52, ${C.cardDeep})`,
        backgroundImage: img ? `url(${img})` : undefined,
        backgroundSize: "cover", backgroundPosition: "center",
        border: `2px solid ${accent}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        ...f.display, fontWeight: 800,
        fontSize: size * 0.3, color: accent,
        letterSpacing: "0.04em", flexShrink: 0,
        boxShadow: `0 0 0 4px ${C.accentGl}`,
      }}
    >
      {!img && initials}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SECTION TAG
═══════════════════════════════════════════════════════════ */
function Tag({ children }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <div style={{ width: 20, height: 2, background: C.accent, borderRadius: 1 }} />
      <span style={{
        ...f.mono, fontSize: 10, fontWeight: 500, color: C.accentLt,
        letterSpacing: "0.22em", textTransform: "uppercase",
      }}>
        {children}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DATA
═══════════════════════════════════════════════════════════ */
const HIERARCHY = [
  {
    category: "Founder",
    accent: "#6366f1",
    members: [{
      initials: "RZ",
      name: "Rana Muhammad Zain ul Abideen",
      title: "Chairman & Founder",
      desc: "Chartered Accountant and enterprise ERP architect who envisioned SCAFIS as a precision decision-making engine. Specialises in financial reporting systems, AI-powered matching logic, and autonomous accounting solutions.",
    }],
  },
  {
    category: "Co-Founder",
    accent: "#a78bfa",
    members: [{
      initials: "AK",
      name: "Ayesha Kashif",
      title: "CEO & Co-Founder",
      desc: "Drives SCAFIS's SaaS growth strategy, product UX, and market adoption. Champions accessibility-first design and sector-specific go-to-market execution.",
    }],
  },
  {
    category: "Advisors",
    accent: "#22d3ee",
    members: [
      {
        initials: "MS",
        name: "Prof. Mohammad Saad Anwar",
        title: "Taxation Advisor",
        desc: "Certified trainer and analytical innovation expert providing strategic oversight on SCAFIS's data pipelines and financial intelligence frameworks.",
      },
      {
        initials: "MR",
        name: "Prof. Muhammed Rehan Anjum",
        title: "Compliance & Data Integrity",
        desc: "Leads advisory on accounting standards and regulatory compliance, ensuring audit-grade accuracy across all modules.",
      },
    ],
  },
  {
    category: "Team",
    accent: "#34d399",
    members: [
      { initials: "FA", name: "Farhan", title: "Legal Advisor", desc: "Handles legal framework, contracts, and corporate compliance for the SCAFIS platform." },
      { initials: "HT", name: "Team Member", title: "Role TBA", desc: "Coming soon." },
      { initials: "SM", name: "Team Member", title: "Role TBA", desc: "Coming soon." },
    ],
  },
];

const MARQUEE_PEOPLE = [
  { initials: "RZ", name: "Rana Zain",   role: "Chairman",       dept: "Founder",   accent: "#6366f1" },
  { initials: "AK", name: "Ayesha Kashif", role: "CEO",           dept: "Leadership",accent: "#a78bfa" },
  { initials: "MS", name: "Prof. Saad",   role: "Tax Advisor",    dept: "Advisory",  accent: "#22d3ee" },
  { initials: "MR", name: "Prof. Rehan",  role: "Compliance",     dept: "Advisory",  accent: "#22d3ee" },
  { initials: "FA", name: "Farhan",       role: "Legal Advisor",  dept: "Team",      accent: "#34d399" },
  { initials: "HT", name: "Team Member",  role: "Engineering",    dept: "Team",      accent: "#34d399" },
  { initials: "SM", name: "Team Member",  role: "Engineering",    dept: "Team",      accent: "#34d399" },
  { initials: "UA", name: "Team Member",  role: "QA",             dept: "Team",      accent: "#34d399" },
  { initials: "FN", name: "Team Member",  role: "Finance",        dept: "Finance",   accent: "#f59e0b" },
  { initials: "ZK", name: "Team Member",  role: "Accounts",       dept: "Finance",   accent: "#f59e0b" },
];

/* ═══════════════════════════════════════════════════════════
   HERO SECTION
═══════════════════════════════════════════════════════════ */
function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y    = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opac = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <section
      ref={ref}
      style={{
        position: "relative", minHeight: "100vh",
        background: `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99,102,241,0.18) 0%, ${C.bg} 65%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* Particle canvas */}
      <ParticleCanvas />

      {/* Grid overlay */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `
          linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)
        `,
        backgroundSize: "64px 64px",
      }} />

      {/* Parallax content */}
      <motion.div style={{ y, opacity: opac, position: "relative", zIndex: 2, textAlign: "center", padding: "0 24px", maxWidth: 860 }}>

        {/* Top badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: "flex", justifyContent: "center", marginBottom: 36 }}
        >
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: C.accentGl, border: `1px solid ${C.accent}40`,
            borderRadius: 40, padding: "8px 18px",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent, boxShadow: `0 0 8px ${C.accent}` }} />
            <span style={{ ...f.mono, fontSize: 10, color: C.accentLt, letterSpacing: "0.22em", textTransform: "uppercase" }}>
              Meet the People Behind SCAFIS
            </span>
          </div>
        </motion.div>

        {/* Main heading */}
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          style={{
            ...f.display, fontSize: "clamp(40px, 7vw, 88px)",
            fontWeight: 800, color: C.textPri,
            lineHeight: 1.0, letterSpacing: "-0.03em",
            margin: "0 0 24px",
          }}
        >
          Our{" "}
          <span style={{
            background: `linear-gradient(135deg, ${C.accent}, ${C.violet}, ${C.accentLt})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            Leadership
          </span>
        </motion.h1>

        {/* Sub */}
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={{
            ...f.body, fontSize: "clamp(15px, 2vw, 18px)",
            color: C.textSec, lineHeight: 1.75, maxWidth: 560, margin: "0 auto 44px",
            fontWeight: 300,
          }}
        >
          Visionaries, scholars, and builders united by a single purpose — to democratise enterprise-grade financial intelligence.
        </motion.p>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            style={{
              width: 36, height: 56, border: `1.5px solid ${C.border}`,
              borderRadius: 18, display: "flex", alignItems: "flex-start",
              justifyContent: "center", padding: "8px 0",
            }}
          >
            <motion.div
              animate={{ y: [0, 18, 0], opacity: [1, 0, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: 4, height: 8, borderRadius: 2, background: C.accentLt }}
            />
          </motion.div>
          <span style={{ ...f.mono, fontSize: 9, color: C.textDim, letterSpacing: "0.18em", textTransform: "uppercase" }}>Scroll</span>
        </motion.div>
      </motion.div>

      {/* Bottom fade */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 120,
        background: `linear-gradient(transparent, ${C.bg})`,
        pointerEvents: "none",
      }} />
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   HIERARCHY — editorial sidebar layout
═══════════════════════════════════════════════════════════ */
function HierarchyRow({ category, members, accent, index }) {
  return (
    <motion.div
      variants={fadeUp}
      style={{
        display: "flex", flexWrap: "wrap", gap: 0,
        borderBottom: `1px solid ${C.border}`,
        paddingBottom: 48, marginBottom: 48,
      }}
    >
      {/* Left: category label */}
      <div style={{ flex: "0 0 180px", minWidth: 140, paddingRight: 32, paddingTop: 4 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: `${accent}14`, border: `1px solid ${accent}33`,
          borderRadius: 6, padding: "4px 10px", marginBottom: 12,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: accent }} />
          <span style={{ ...f.mono, fontSize: 9, fontWeight: 500, color: accent, letterSpacing: "0.2em", textTransform: "uppercase" }}>
            {category}
          </span>
        </div>
        {/* vertical rule */}
        <div style={{ width: 1, height: 32, background: `linear-gradient(${accent}, transparent)`, marginLeft: 2 }} />
      </div>

      {/* Right: member cards */}
      <div style={{ flex: 1, minWidth: 280, display: "flex", flexWrap: "wrap", gap: 16 }}>
        {members.map((m, i) => (
          <MemberCard key={m.name} member={m} accent={accent} delay={i * 0.08} />
        ))}
      </div>
    </motion.div>
  );
}

function MemberCard({ member, accent, delay }) {
  const [hov, setHov] = useState(false);
  return (
    <motion.div
      variants={fadeUp}
      transition={{ delay }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: "1 1 280px", maxWidth: 440,
        background: hov ? `linear-gradient(145deg, #161b34, ${C.cardDeep})` : C.card,
        border: `1px solid ${hov ? accent + "55" : C.border}`,
        borderRadius: 16, padding: "24px",
        display: "flex", gap: 18, alignItems: "flex-start",
        cursor: "default", transition: "all .28s cubic-bezier(.22,1,.36,1)",
        boxShadow: hov ? `0 16px 48px ${accent}18` : "none",
        position: "relative", overflow: "hidden",
      }}
    >
      {/* accent corner */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: hov ? `linear-gradient(90deg, ${accent}, transparent)` : "transparent",
        transition: "all .28s",
      }} />

      <Avatar initials={member.initials} size={54} accent={accent} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ ...f.display, fontSize: 15, fontWeight: 700, color: C.textPri, marginBottom: 3, letterSpacing: "-0.01em" }}>
          {member.name}
        </p>
        <p style={{ ...f.mono, fontSize: 9.5, color: accent, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10, fontWeight: 500 }}>
          {member.title}
        </p>
        <p style={{ ...f.body, fontSize: 12.5, color: C.textSec, lineHeight: 1.72, margin: 0 }}>
          {member.desc}
        </p>
      </div>
    </motion.div>
  );
}

function LeadershipHierarchy() {
  return (
    <section style={{ background: C.bg, padding: "96px 24px 48px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>

        <Reveal>
          <Tag>Organisation</Tag>
          <h2 style={{
            ...f.display, fontSize: "clamp(28px, 4vw, 48px)",
            fontWeight: 800, color: C.textPri,
            letterSpacing: "-0.03em", margin: "0 0 8px",
          }}>
            Leadership Hierarchy
          </h2>
          <p style={{ ...f.body, fontSize: 14, color: C.textSec, margin: "0 0 64px", maxWidth: 480, lineHeight: 1.7 }}>
            The structure that powers SCAFIS — from visionary founders to technical builders.
          </p>
        </Reveal>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.05 }}
          variants={stagger}
        >
          {HIERARCHY.map((group, i) => (
            <HierarchyRow
              key={group.category}
              category={group.category}
              members={group.members}
              accent={group.accent}
              index={i}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   CEO SPOTLIGHT
═══════════════════════════════════════════════════════════ */
function CEOSpotlight() {
  const VISION = [
    "SaaS growth strategy — scaling outreach and accelerating enterprise business development.",
    "User experience priorities — championing product accessibility and design-first standards.",
    "Market adoption goals — driving client acquisition and sector-specific GTM strategies.",
  ];

  return (
    <section style={{ background: C.bg, padding: "0 24px 96px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>

        <Reveal>
          <Tag>Executive</Tag>
          <h2 style={{
            ...f.display, fontSize: "clamp(28px, 4vw, 48px)",
            fontWeight: 800, color: C.textPri,
            letterSpacing: "-0.03em", margin: "0 0 40px",
          }}>
            CEO Spotlight
          </h2>
        </Reveal>

        <Reveal>
          <div style={{
            display: "flex", flexWrap: "wrap",
            borderRadius: 20, overflow: "hidden",
            border: `1px solid ${C.border}`,
            boxShadow: `0 32px 80px rgba(0,0,0,0.5)`,
          }}>
            {/* LEFT portrait */}
            <div style={{
              flex: "0 0 300px", minWidth: 220,
              background: `radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.18) 0%, #0d1020 100%)`,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: "56px 28px", gap: 20,
              position: "relative", overflow: "hidden",
              borderRight: `1px solid ${C.border}`,
            }}>
              {/* dot grid */}
              <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.05, pointerEvents: "none" }}>
                <defs>
                  <pattern id="ceo-dots" width="24" height="24" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1.2" fill={C.accent} />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#ceo-dots)" />
              </svg>

              <div className="float-card">
                <Avatar initials="AK" size={120} accent={C.accent} pulse />
              </div>

              <div style={{ textAlign: "center", position: "relative" }}>
                <p style={{ ...f.display, fontSize: 20, fontWeight: 800, color: C.textPri, letterSpacing: "-0.01em", marginBottom: 8 }}>
                  Ayesha Kashif
                </p>
                <div style={{
                  display: "inline-flex",
                  background: C.accentGl, border: `1px solid ${C.accent}40`,
                  borderRadius: 20, padding: "4px 14px",
                }}>
                  <span style={{ ...f.mono, fontSize: 9, color: C.accentLt, letterSpacing: "0.18em", textTransform: "uppercase" }}>
                    CEO &amp; Co-Founder
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 20 }}>
                {[{ val: "3+", lbl: "Years" }, { val: "50+", lbl: "Clients" }].map(s => (
                  <div key={s.lbl} style={{ textAlign: "center" }}>
                    <p style={{ ...f.display, fontSize: 22, fontWeight: 800, color: C.accent, margin: 0 }}>{s.val}</p>
                    <p style={{ ...f.mono, fontSize: 9, color: C.textDim, letterSpacing: "0.15em", textTransform: "uppercase", margin: 0 }}>{s.lbl}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT vision */}
            <div style={{ flex: 1, minWidth: 280, background: C.card, padding: "48px 44px" }}>
              <p style={{ ...f.mono, fontSize: 9.5, color: C.accentLt, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 28 }}>
                Strategic Operational Vision
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {VISION.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.12, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      display: "flex", gap: 16, alignItems: "flex-start",
                      padding: "16px 18px",
                      background: C.accentG2, border: `1px solid ${C.border}`,
                      borderRadius: 12, cursor: "default",
                      transition: "border-color .2s, background .2s",
                    }}
                    whileHover={{ borderColor: C.accent + "55", backgroundColor: C.accentGl }}
                  >
                    <div style={{
                      width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                      background: C.accentGl, border: `1px solid ${C.accent}44`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ ...f.mono, fontSize: 10, fontWeight: 700, color: C.accentLt }}>{i + 1}</span>
                    </div>
                    <p style={{ ...f.body, fontSize: 13.5, color: C.textSec, lineHeight: 1.75, margin: 0 }}>
                      {item}
                    </p>
                  </motion.div>
                ))}
              </div>

              {/* quote */}
              <div style={{ marginTop: 28, borderLeft: `2px solid ${C.accent}`, paddingLeft: 16 }}>
                <p style={{ ...f.body, fontSize: 13, color: C.textDim, fontStyle: "italic", lineHeight: 1.7, margin: 0 }}>
                  "Building SCAFIS into a platform every finance professional can rely on — from SMEs to enterprise."
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   TEAM MARQUEE
═══════════════════════════════════════════════════════════ */
function MarqueeCard({ person }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flexShrink: 0, width: 180,
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: 12,
        padding: "24px 20px",
        background: hov ? `linear-gradient(160deg, #161b34, ${C.cardDeep})` : C.card,
        border: `1px solid ${hov ? person.accent + "55" : C.border}`,
        borderRadius: 16, margin: "0 10px",
        cursor: "default", transition: "all .25s cubic-bezier(.22,1,.36,1)",
        transform: hov ? "scale(1.06)" : "scale(1)",
        boxShadow: hov ? `0 16px 40px ${person.accent}22` : "none",
      }}
    >
      <div style={{
        width: 68, height: 68, borderRadius: "50%",
        background: `radial-gradient(circle at 38% 38%, #252d52, ${C.cardDeep})`,
        border: `2px solid ${hov ? person.accent : C.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        ...f.display, fontWeight: 800, fontSize: 18,
        color: hov ? person.accent : C.textSec,
        transition: "all .25s",
        boxShadow: hov ? `0 0 0 4px ${person.accent}22, 0 8px 24px ${person.accent}22` : "none",
      }}>
        {person.initials}
      </div>

      <div style={{ textAlign: "center" }}>
        <p style={{ ...f.body, fontSize: 13, fontWeight: 600, color: hov ? C.textPri : C.textSec, margin: "0 0 3px", transition: "color .2s" }}>
          {person.name}
        </p>
        <p style={{ ...f.mono, fontSize: 9.5, color: hov ? person.accent : C.textDim, letterSpacing: "0.1em", textTransform: "uppercase", margin: 0, transition: "color .2s" }}>
          {person.role}
        </p>
      </div>

      <div style={{
        background: `${person.accent}18`, border: `1px solid ${person.accent}33`,
        borderRadius: 10, padding: "2px 10px",
        ...f.mono, fontSize: 8.5, color: person.accent, letterSpacing: "0.12em", textTransform: "uppercase",
      }}>
        {person.dept}
      </div>
    </div>
  );
}

function TeamMarquee() {
  const doubled = [...MARQUEE_PEOPLE, ...MARQUEE_PEOPLE];

  return (
    <section style={{ background: C.cardDeep, padding: "88px 0", borderTop: `1px solid ${C.border}`, overflow: "hidden" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px", marginBottom: 48 }}>
        <Reveal>
          <Tag>Full Team</Tag>
          <h2 style={{
            ...f.display, fontSize: "clamp(28px, 4vw, 48px)",
            fontWeight: 800, color: C.textPri,
            letterSpacing: "-0.03em", margin: "0 0 8px",
          }}>
            Everyone Building SCAFIS
          </h2>
          <p style={{ ...f.body, fontSize: 14, color: C.textSec, lineHeight: 1.7, maxWidth: 420 }}>
            Hover to pause · Scroll to explore
          </p>
        </Reveal>
      </div>

      {/* Fade edges */}
      <div style={{ position: "relative" }}>
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 120, zIndex: 2,
          background: `linear-gradient(90deg, ${C.cardDeep}, transparent)`,
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: 120, zIndex: 2,
          background: `linear-gradient(-90deg, ${C.cardDeep}, transparent)`,
          pointerEvents: "none",
        }} />

        <div
          className="marquee-track"
          style={{ display: "flex", alignItems: "stretch", width: "max-content" }}
        >
          {doubled.map((p, i) => (
            <MarqueeCard key={i} person={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   ROOT
═══════════════════════════════════════════════════════════ */
export default function LeadershipPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45 }}
      style={{ background: C.bg, minHeight: "100vh" }}
    >
      <Navbar />
      <Hero />
      <LeadershipHierarchy />
      <CEOSpotlight />
      <TeamMarquee />
      <Footer />
    </motion.div>
  );
}
