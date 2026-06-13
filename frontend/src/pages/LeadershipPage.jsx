/**
 * LeadershipPage.jsx  —  SCAFIS Leadership Redesign (Deep Dark Blue Theme)
 *
 * Color theme matches Home, About, and Contact pages (#030b1a background, emerald/cyan accents).
 * All fonts: Inter or system sans-serif, weights 400/500/600 only — NO 800/900.
 */

import { useEffect, useRef, useState } from "react";
import { motion as M } from "framer-motion";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

/* ═══ DESIGN TOKENS ══════════════════════════════════════════════════════════ */
const C = {
  bg: "#030b1a",
  card: "rgba(255, 255, 255, 0.025)",
  cardDeep: "#040e1f",
  border: "rgba(255, 255, 255, 0.08)",
  borderLo: "rgba(255, 255, 255, 0.05)",
  accent: "#10b981", // Emerald
  accentLt: "#6ee7b7",
  skyBlue: "#10b981", // Emerald accent for Founder Spotlight
  violet: "#06b6d4", // Cyan accent for CEO Spotlight
  green: "#10b981",
  amber: "#f59e0b",
  cyan: "#06b6d4",
  textPri: "#ffffff",
  textSec: "#94a3b8",
  textDim: "#6b7280",
};

/* ═══ KEYFRAMES & STYLES ══════════════════════════════════════════════════════ */
if (typeof document !== "undefined" && !document.getElementById("lp-styles-redesign")) {
  const s = document.createElement("style");
  s.id = "lp-styles-redesign";
  s.textContent = `
    @keyframes lp-marquee    { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
    @keyframes lp-float      { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-8px) rotate(.5deg)} }
    @keyframes lp-pulse      { 0%{box-shadow:0 0 0 0 rgba(16,185,129,.4)} 70%{box-shadow:0 0 0 16px rgba(16,185,129,0)} 100%{box-shadow:0 0 0 0 rgba(16,185,129,0)} }
    @keyframes lp-shimmer    { 0%,100%{opacity:.4} 50%{opacity:1} }
    .lp-mq-track            { animation: lp-marquee 30s linear infinite; }
    .lp-mq-track:hover      { animation-play-state: paused; }
    .lp-float               { animation: lp-float 5s ease-in-out infinite; }
    .lp-pulse               { animation: lp-pulse 2.5s ease-out infinite; }
    .lp-shimmer             { animation: lp-shimmer 2.5s ease-in-out infinite; }
    
    .lp-card-hover {
      transition: transform 0.25s, border-color 0.25s, box-shadow 0.25s;
    }
    .lp-card-hover:hover {
      transform: translateY(-6px);
      border-color: rgba(16, 185, 129, 0.4) !important;
      box-shadow: 0 16px 32px rgba(0, 0, 0, 0.4);
    }

    @media (max-width: 768px) {
      .lp-stat-divider-desktop { display: none !important; }
      .lp-spotlight-card {
        flex-direction: column !important;
      }
      .lp-spotlight-left {
        border-right: none !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
        padding: 36px 20px !important;
      }
      .lp-spotlight-right {
        padding: 24px 20px !important;
      }
      .lp-advisor-card-body {
        padding: 20px 20px 16px !important;
      }
    }
    @media (min-width: 769px) {
      .lp-stat-divider-desktop { display: block !important; }
    }
  `;
  document.head.appendChild(s);
}

/* ═══ DATA ARRAYS (PRESERVED) ════════════════════════════════════════════════ */
const TEAM_MEMBERS = [
  {
    initials: "FA", name: "Farhan", title: "Legal Advisor", accent: C.green,
    desc: "Handles legal framework, contracts, and corporate compliance for the SCAFIS platform."
  },
  { initials: "HT", name: "Team Member", title: "Role TBA", accent: C.green, desc: "Coming soon." },
  { initials: "SM", name: "Team Member", title: "Role TBA", accent: C.green, desc: "Coming soon." },
];

const VERTICAL_DETAILS = [
  {
    title: "Strategic Core",
    label: "Vertical 01",
    accent: C.accent,
    bgColor: "rgba(16,185,129,0.05)",
    tagline: "Foundational vision and executive steering.",
    desc: "The Strategic Core shapes SCAFIS's long-term business models, technical roadmaps, and autonomous growth objectives. It directs cross-disciplinary synchronization across Advisory and Engineering to achieve industry-leading solutions.",
    tags: ["Foundational Vision", "Executive Steering", "SaaS Strategy", "GTM Execution"],
    objectives: [
      "Define long-term technical architecture principles and system design priorities.",
      "Formulate market acquisition, sector-specific expansion, and GTM strategy.",
      "Oversee and coordinate cooperation between Advisory Board and Engineering groups."
    ],
    members: [
      { initials: "RZ", name: "Rana Muhammad Zain", title: "Chairman & Founder", accent: C.skyBlue, desc: "Architected SCAFIS ERP system & financial intelligence engine from the ground up." },
      { initials: "AK", name: "Ayesha Kashif", title: "CEO & Co-Founder", accent: C.violet, desc: "Drives strategic operational vision, SaaS outreach, and sector-specific scaling." }
    ]
  },
  {
    title: "Advisory Council",
    label: "Vertical 02",
    accent: C.amber,
    bgColor: "rgba(245,158,11,0.05)",
    tagline: "Academic oversight and regulatory compliance.",
    desc: "The Advisory Council provides academic verification, legal frameworks, and regulatory auditing. This oversight guarantees SCAFIS matches strict tax codes and IFRS compliance standards worldwide.",
    tags: ["Academic Rigour", "Regulatory Auditing", "IFRS Compliance", "Tax Legislation"],
    objectives: [
      "Formulate and audit SCAFIS data schemas against international IFRS compliance standards.",
      "Advise on taxation compliance rules and regulatory legal definitions.",
      "Perform continuous audits of decision-making algorithms to ensure intellectual precision."
    ],
    members: [
      { initials: "MS", name: "Prof. Mohammad Saad Anwar", title: "Taxation Lawyer", accent: C.cyan, desc: "Certified trainer providing strategic oversight on data pipelines and tax law." },
      { initials: "MR", name: "Prof. Muhammed Rehan Anjum", title: "Accountant", accent: C.amber, desc: "IFRS compliance authority and expert on enterprise data governance." }
    ]
  },
  {
    title: "Product & Tech",
    label: "Vertical 03",
    accent: C.green,
    bgColor: "rgba(16,185,129,0.05)",
    tagline: "Architecture, AI logic, and SaaS engineering.",
    desc: "Product & Tech builds and tests the core codebase of the SCAFIS platform, engineering automated transaction matchers, real-time analytics engines, and clean web application dashboards.",
    tags: ["Ledger Architecture", "AI Matching Logic", "SaaS Engineering", "Real-time Queries"],
    objectives: [
      "Build high-speed ledger query engines and automatic journal-matching pipelines.",
      "Develop predictive cash flow analysis and autonomous accounting logic.",
      "Deploy and maintain modern, secure cloud infrastructure for SaaS delivery."
    ],
    members: [
      { initials: "HT", name: "Team Member", title: "Role TBA", accent: C.green, desc: "SaaS platform developer specializing in secure backend structures and interface state." },
      { initials: "SM", name: "Team Member", title: "Role TBA", accent: C.green, desc: "AI matching logic systems builder and query optimizer." }
    ]
  },
  {
    title: "Global Ops",
    label: "Vertical 04",
    accent: C.cyan,
    bgColor: "rgba(34,211,238,0.05)",
    tagline: "Market strategy, legal, and financial framework.",
    desc: "Global Ops coordinates market operations, platform risks, legal entity setups, and licensing protocols to scale SCAFIS safely in global markets.",
    tags: ["Market Expansion", "Legal Framework", "Financial Systems", "Risk Auditing"],
    objectives: [
      "Manage licensing, IP protection, and cross-border regulatory compliance.",
      "Coordinate customer support protocols and user onboarding frameworks.",
      "Oversee company financial audits, bookkeeping systems, and treasury logic."
    ],
    members: [
      { initials: "FA", name: "Farhan", title: "Legal Advisor", accent: C.green, desc: "Handles legal framework, contract templates, and platform corporate compliance." }
    ]
  }
];

const ADVISORS = [
  {
    initials: "MS", name: "Prof. Mohammad Saad Anwar", title: "Taxation Lawyer",
    accent: "#06b6d4", glow: "rgba(6,182,212,0.13)",
    expertise: ["Tax Law", "Analytics", "Regulatory"],
    desc: "Certified trainer and analytical innovation expert providing strategic oversight on SCAFIS's data pipelines and financial intelligence frameworks. Brings deep expertise in tax legislation and corporate advisory.",
    impact: [{ val: "15+", lbl: "Years" }, { val: "200+", lbl: "Cases" }],
  },
  {
    initials: "MR", name: "Prof. Muhammed Rehan Anjum", title: "Accountant",
    accent: "#f59e0b", glow: "rgba(245,158,11,0.13)",
    expertise: ["IFRS", "Compliance", "Data Integrity"],
    desc: "Leads advisory on accounting standards and regulatory compliance, ensuring audit-grade accuracy across all SCAFIS modules. Authority on IFRS implementation and enterprise data governance.",
    impact: [{ val: "18+", lbl: "Years" }, { val: "300+", lbl: "Audits" }],
  },
];

const MQ_DATA = [
  { initials: "RZ", name: "Rana Zain", role: "Chairman", dept: "Founder", accent: C.accent },
  { initials: "AK", name: "Ayesha Kashif", role: "CEO", dept: "Executive", accent: C.violet },
  { initials: "MS", name: "Prof. Saad", role: "Taxation Lawyer", dept: "Advisory", accent: C.cyan },
  { initials: "MR", name: "Prof. Rehan", role: "Accountant", dept: "Advisory", accent: C.amber },
  { initials: "FA", name: "Farhan", role: "Legal", dept: "Team", accent: C.green },
  { initials: "HT", name: "Team Member", role: "Engineering", dept: "Team", accent: C.green },
  { initials: "SM", name: "Team Member", role: "Engineering", dept: "Team", accent: C.green },
  { initials: "UA", name: "Team Member", role: "QA", dept: "Team", accent: C.green },
  { initials: "FN", name: "Team Member", role: "Finance", dept: "Finance", accent: C.amber },
  { initials: "ZK", name: "Team Member", role: "Accounts", dept: "Finance", accent: C.amber },
];

/* ═══ 3D PARTICLE CANVAS (PRESERVED) ═════════════════════════════════════════ */
function ParticleCanvas() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d");
    let raf, W, H, pts = [];
    const COLS = ["rgba(16,185,129,.4)", "rgba(6,182,212,.3)", "rgba(167,139,250,.2)", "rgba(34,211,238,.1)"];
    const resize = () => { W = c.width = c.offsetWidth; H = c.height = c.offsetHeight; };
    const spawn = () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.5 + .3,
      vx: (Math.random() - .5) * 0.15, vy: (Math.random() - .5) * 0.15,
      col: COLS[Math.floor(Math.random() * COLS.length)],
      a: Math.random() * .5 + .2, life: 0,
      max: 200 + Math.random() * 200,
    });
    const init = () => { pts = Array.from({ length: 50 }, spawn); };
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, d = Math.hypot(dx, dy);
        if (d < 100) { ctx.beginPath(); ctx.strokeStyle = `rgba(16,185,129,${.05 * (1 - d / 100)})`; ctx.lineWidth = .3; ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke(); }
      }
      pts.forEach((p, idx) => {
        p.x += p.vx; p.y += p.vy; p.life++;
        if (p.x < 0 || p.x > W || p.y < 0 || p.y > H || p.life > p.max) { pts[idx] = spawn(); return; }
        const f = p.life < 30 ? p.life / 30 : p.life > p.max - 30 ? (p.max - p.life) / 30 : 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.col.replace(/[\d.]+\)$/, `${p.a * f})`); ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    resize(); init(); draw();
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />;
}

/* ═══ AVATAR COMPONENT ═══════════════════════════════════════════════════════ */
function Avatar({ initials, size = 64, accent = "#10b981" }) {
  return (
    <div style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: "50%",
      backgroundColor: "#1e293b",
      border: `2.5px solid ${accent}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter', sans-serif",
      fontSize: `${size * 0.33}px`,
      fontWeight: 600,
      color: accent,
      boxShadow: `0 0 12px ${accent}22`,
      flexShrink: 0
    }}>
      {initials}
    </div>
  );
}

/* ═══ SPOTLIGHT COMPONENT ════════════════════════════════════════════════════ */
function SpotlightPanel({ person, missionLabel, missions, quote, stats, accent, isCeoLevel = false }) {
  const leftBg = isCeoLevel 
    ? `radial-gradient(circle at 50% 0%, rgba(6, 182, 212, 0.15) 0%, #030b1a 100%)` 
    : `radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.15) 0%, #030b1a 100%)`;

  const borderCol = isCeoLevel ? "#06b6d4" : "#10b981";
  const avatarBorder = isCeoLevel ? "#06b6d4" : "#10b981";

  return (
    <div className="lp-spotlight-card" style={{
      display: "flex",
      flexWrap: "wrap",
      borderRadius: "20px",
      overflow: "hidden",
      border: `1px solid ${C.border}`,
      backgroundColor: C.card,
      boxShadow: "0 20px 40px rgba(0,0,0,0.3)"
    }}>
      {/* LEFT Portrait */}
      <div className="lp-spotlight-left" style={{
        flex: "1 1 300px",
        background: leftBg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        gap: "20px",
        borderRight: `1px solid ${C.border}`,
        position: "relative"
      }}>
        <div style={{
          position: "absolute",
          top: "10%",
          width: "160px",
          height: "160px",
          borderRadius: "50%",
          background: isCeoLevel ? "rgba(6, 182, 212, 0.2)" : "rgba(16, 185, 129, 0.2)",
          filter: "blur(40px)",
          pointerEvents: "none"
        }} />

        <div className="lp-float">
          <Avatar initials={person.initials} size={110} accent={avatarBorder} />
        </div>

        <div style={{ textAlign: "center" }}>
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "18px",
            fontWeight: 600,
            color: "#f1f5f9",
            margin: "0 0 6px"
          }}>{person.name}</p>
          <div style={{
            display: "inline-block",
            backgroundColor: isCeoLevel ? "rgba(6, 182, 212, 0.15)" : "rgba(16, 185, 129, 0.15)",
            border: `1px solid ${isCeoLevel ? "rgba(6, 182, 212, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
            borderRadius: "16px",
            padding: "4px 12px"
          }}>
            <span style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "9px",
              fontWeight: 600,
              color: isCeoLevel ? "#22d3ee" : "#6ee7b7",
              letterSpacing: "0.1em",
              textTransform: "uppercase"
            }}>{person.title}</span>
          </div>
        </div>

        {stats && (
          <div style={{ display: "flex", gap: "24px", marginTop: "8px" }}>
            {stats.map(s => (
              <div key={s.lbl} style={{ textAlign: "center" }}>
                <p style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "24px",
                  fontWeight: 600,
                  color: isCeoLevel ? "#06b6d4" : "#10b981",
                  margin: 0
                }}>{s.val}</p>
                <p style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "9px",
                  fontWeight: 500,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  margin: 0
                }}>{s.lbl}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT Vision / Missions */}
      <div className="lp-spotlight-right" style={{
        flex: "2 1 400px",
        padding: "48px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: C.card
      }}>
        <div>
          <h4 style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "11px",
            fontWeight: 600,
            color: isCeoLevel ? "#06b6d4" : "#10b981",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            marginBottom: "24px",
            margin: 0
          }}>{missionLabel}</h4>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {missions.map((m, idx) => (
              <div key={idx} style={{
                display: "flex",
                gap: "16px",
                alignItems: "flex-start",
                padding: "16px",
                backgroundColor: C.cardDeep,
                border: `1px solid ${C.border}`,
                borderRadius: "12px"
              }}>
                <div style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  backgroundColor: isCeoLevel ? "rgba(6, 182, 212, 0.15)" : "rgba(16, 185, 129, 0.15)",
                  border: `1px solid ${isCeoLevel ? "rgba(6, 182, 212, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}>
                  <span style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: isCeoLevel ? "#06b6d4" : "#10b981"
                  }}>{idx + 1}</span>
                </div>
                <p style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "13.5px",
                  lineHeight: "1.6",
                  color: "#94a3b8",
                  margin: 0
                }}>{m}</p>
              </div>
            ))}
          </div>
        </div>

        {quote && (
          <div style={{
            marginTop: "24px",
            borderLeft: `3px solid ${borderCol}`,
            paddingLeft: "16px"
          }}>
            <p style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "13.5px",
              fontStyle: "italic",
              lineHeight: "1.6",
              color: "#94a3b8",
              margin: 0
            }}>
              "{quote}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTIONS
   1. HERO
   2. FOUNDER SPOTLIGHT
   3. ADVISORS
   4. CEO SPOTLIGHT
   5. TEAM SECTION
   6. TEAM MARQUEE
═══════════════════════════════════════════════════════════════════════════ */
function Hero() {
  return (
    <section style={{
      position: "relative",
      padding: "160px 24px 80px", // Padded for sticky navbar layout
      backgroundColor: "#030b1a",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      minHeight: "75vh",
      textAlign: "center"
    }}>
      <ParticleCanvas />
      
      <div style={{
        position: "absolute",
        top: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        height: "100%",
        background: "radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, transparent 70%)",
        pointerEvents: "none",
        zIndex: 1
      }} />

      <div style={{ position: "relative", zIndex: 2, maxWidth: "800px", margin: "0 auto" }}>
        {/* Eyebrow */}
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          backgroundColor: "rgba(16, 185, 129, 0.08)",
          border: "1px solid rgba(16, 185, 129, 0.25)",
          borderRadius: "40px",
          padding: "6px 16px",
          marginBottom: "24px"
        }}>
          <div className="lp-shimmer" style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: "#6ee7b7"
          }} />
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "11px",
            fontWeight: 500,
            color: "#6ee7b7",
            letterSpacing: "0.15em",
            textTransform: "uppercase"
          }}>
            Meet the People Behind SCAFIS
          </span>
        </div>

        {/* Title */}
        <h1 style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: "clamp(36px, 6vw, 64px)",
          fontWeight: 600,
          color: "#ffffff",
          lineHeight: "1.1",
          letterSpacing: "-0.02em",
          margin: "0 0 20px"
        }}>
          Our{" "}
          <span style={{
            background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text"
          }}>
            Leadership
          </span>
        </h1>

        {/* Subtitle */}
        <p style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: "16px",
          lineHeight: "1.6",
          color: "#94a3b8",
          maxWidth: "540px",
          margin: "0 auto 48px",
          fontWeight: 400
        }}>
          Visionaries, scholars, and builders united by a single purpose — to democratise enterprise-grade financial intelligence.
        </p>

        {/* Stats */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "24px",
          marginBottom: "40px",
          flexWrap: "wrap"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "28px", fontWeight: 600, color: "#ffffff", fontFamily: "'Inter', sans-serif" }}>12+</div>
              <div style={{ fontSize: "11px", fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Years</div>
            </div>
            <div style={{ width: "1px", height: "32px", backgroundColor: "rgba(255,255,255,0.08)" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "28px", fontWeight: 600, color: "#ffffff", fontFamily: "'Inter', sans-serif" }}>4</div>
              <div style={{ fontSize: "11px", fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>ERP Systems</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
            <div style={{ width: "1px", height: "32px", backgroundColor: "rgba(255,255,255,0.08)" }} className="lp-stat-divider-desktop" />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "28px", fontWeight: 600, color: "#ffffff", fontFamily: "'Inter', sans-serif" }}>50+</div>
              <div style={{ fontSize: "11px", fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Companies</div>
            </div>
          </div>
        </div>

        {/* Pills */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          flexWrap: "wrap"
        }}>
          {["Founded 2022", "ERP Specialists", "50+ Clients"].map((pill) => (
            <div key={pill} style={{
              backgroundColor: "rgba(255, 255, 255, 0.025)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "20px",
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 500,
              color: "#94a3b8",
              fontFamily: "'Inter', sans-serif"
            }}>
              {pill}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FounderSpotlight() {
  return (
    <section style={{
      backgroundColor: "#030b1a",
      padding: "80px 24px 40px",
      borderTop: "1px solid rgba(255, 255, 255, 0.05)",
      fontFamily: "'Inter', system-ui, sans-serif"
    }}>
      <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
        <div style={{ marginBottom: "32px" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            borderRadius: "40px",
            padding: "4px 12px",
            marginBottom: "16px"
          }}>
            <span style={{ fontSize: "10px", fontWeight: 600, color: "#6ee7b7", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Founder
            </span>
          </div>
          <h2 style={{ fontSize: "28px", fontWeight: 600, color: "#ffffff", margin: 0, letterSpacing: "-0.01em" }}>
            Founder Spotlight
          </h2>
        </div>
        
        <SpotlightPanel
          person={{ initials: "RZ", name: "Rana Muhammad Zain ul Abideen", title: "Chairman & Founder" }}
          missionLabel="Founder's Mission for SCAFIS"
          stats={[{ val: "12+", lbl: "Years" }, { val: "4", lbl: "ERP Systems" }, { val: "50+", lbl: "Companies" }]}
          missions={[
            "Built SCAFIS as a comprehensive ERP solution from the ground up — architecting it as a precision decision-making engine for modern organisations.",
            "Specialises in financial reporting systems, AI-powered matching logic, and autonomous accounting solutions at enterprise scale.",
            "Democratising enterprise-grade financial intelligence for businesses of every size — from SMEs to large corporations."
          ]}
          quote="SCAFIS is not just software — it's a financial intelligence platform that evolves with your business."
          accent="#10b981"
          isCeoLevel={false}
        />
      </div>
    </section>
  );
}

function AdvisorsSection() {
  return (
    <section style={{
      backgroundColor: "#030b1a",
      padding: "80px 24px",
      borderTop: "1px solid rgba(255, 255, 255, 0.05)",
      fontFamily: "'Inter', system-ui, sans-serif"
    }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <div style={{ marginBottom: "48px" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.2)",
            borderRadius: "40px",
            padding: "4px 12px",
            marginBottom: "16px"
          }}>
            <span style={{ fontSize: "10px", fontWeight: 600, color: "#10b981", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Advisory Board
            </span>
          </div>
          <h2 style={{ fontSize: "28px", fontWeight: 600, color: "#ffffff", margin: "0 0 12px", letterSpacing: "-0.01em" }}>
            Mentors &amp; Academic Advisors
          </h2>
          <p style={{ fontSize: "14px", color: "#94a3b8", margin: 0, maxWidth: "540px", lineHeight: "1.6" }}>
            Distinguished academics and industry leaders who shape SCAFIS's intellectual and strategic foundation.
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "24px"
        }}>
          {ADVISORS.map((adv) => (
            <div
              key={adv.name}
              style={{
                backgroundColor: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: "20px",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column"
              }}
              className="lp-card-hover"
            >
              <div style={{ height: "3px", backgroundColor: adv.accent }} />

              <div className="lp-advisor-card-body" style={{ padding: "28px 28px 24px", flex: 1 }}>
                <div style={{ display: "flex", gap: "20px", alignItems: "flex-start", marginBottom: "20px" }}>
                  <Avatar initials={adv.initials} size={64} accent={adv.accent} />
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#ffffff", margin: "0 0 6px" }}>{adv.name}</h3>
                    <div style={{
                      display: "inline-block",
                      backgroundColor: `${adv.accent}15`,
                      border: `1px solid ${adv.accent}30`,
                      borderRadius: "16px",
                      padding: "2px 10px",
                      marginBottom: "8px"
                    }}>
                      <span style={{ fontSize: "9px", fontWeight: 600, color: adv.accent, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {adv.title}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" }}>
                  {adv.expertise.map(tag => (
                    <span key={tag} style={{
                      backgroundColor: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#94a3b8",
                      borderRadius: "8px",
                      padding: "2px 8px",
                      fontSize: "11px",
                      fontWeight: 500
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>

                <p style={{ fontSize: "13.5px", lineHeight: "1.6", color: "#94a3b8", margin: 0 }}>
                  {adv.desc}
                </p>
              </div>

              <div style={{
                display: "flex",
                borderTop: `1px solid ${C.border}`,
                backgroundColor: C.cardDeep
              }}>
                {adv.impact.map((imp) => (
                  <div key={imp.lbl} style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "16px 12px",
                    borderRight: `1px solid ${C.border}`
                  }}>
                    <div style={{ fontSize: "20px", fontWeight: 600, color: adv.accent }}>{imp.val}</div>
                    <div style={{ fontSize: "9px", fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{imp.lbl}</div>
                  </div>
                ))}
                <div style={{
                  flex: 1.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "16px",
                  textAlign: "center"
                }}>
                  <span style={{ fontSize: "10px", fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", lineHeight: "1.4" }}>
                    Academic Advisor<br />SCAFIS Board
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CEOSpotlight() {
  return (
    <section style={{
      backgroundColor: "#030b1a",
      padding: "40px 24px 80px",
      borderTop: "1px solid rgba(255, 255, 255, 0.05)",
      fontFamily: "'Inter', system-ui, sans-serif"
    }}>
      <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
        <div style={{ marginBottom: "32px" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "rgba(6, 182, 212, 0.08)",
            border: "1px solid rgba(6, 182, 212, 0.25)",
            borderRadius: "40px",
            padding: "4px 12px",
            marginBottom: "16px"
          }}>
            <span style={{ fontSize: "10px", fontWeight: 600, color: "#22d3ee", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Executive
            </span>
          </div>
          <h2 style={{ fontSize: "28px", fontWeight: 600, color: "#ffffff", margin: 0, letterSpacing: "-0.01em" }}>
            CEO Spotlight
          </h2>
        </div>
        
        <SpotlightPanel
          person={{ initials: "AK", name: "Ayesha Kashif", title: "CEO & Co-Founder" }}
          missionLabel="Strategic Operational Vision"
          stats={[{ val: "3+", lbl: "Years" }, { val: "50+", lbl: "Clients" }]}
          missions={[
            "SaaS growth strategy — scaling outreach and accelerating enterprise business development.",
            "User experience priorities — championing product accessibility and design-first standards.",
            "Market adoption goals — driving client acquisition and sector-specific GTM strategies."
          ]}
          quote="Building SCAFIS into a platform every finance professional can rely on — from SMEs to enterprise."
          accent="#06b6d4"
          isCeoLevel={true}
        />
      </div>
    </section>
  );
}

function TeamSection() {
  return (
    <section style={{
      backgroundColor: "#030b1a",
      padding: "80px 24px",
      borderTop: "1px solid rgba(255, 255, 255, 0.05)",
      fontFamily: "'Inter', system-ui, sans-serif"
    }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <div style={{ marginBottom: "48px" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.2)",
            borderRadius: "40px",
            padding: "4px 12px",
            marginBottom: "16px"
          }}>
            <span style={{ fontSize: "10px", fontWeight: 600, color: "#10b981", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Core Team
            </span>
          </div>
          <h2 style={{ fontSize: "28px", fontWeight: 600, color: "#ffffff", margin: "0 0 12px", letterSpacing: "-0.01em" }}>
            Our Team
          </h2>
          <p style={{ fontSize: "14px", color: "#94a3b8", margin: 0, maxWidth: "540px", lineHeight: "1.6" }}>
            The talented individuals who build and maintain SCAFIS day by day.
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "24px"
        }}>
          {TEAM_MEMBERS.map((m) => (
            <div
              key={m.name}
              style={{
                backgroundColor: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: "20px",
                padding: "24px",
                display: "flex",
                gap: "16px",
                alignItems: "flex-start"
              }}
              className="lp-card-hover"
            >
              <Avatar initials={m.initials} size={52} accent="#10b981" />
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#ffffff", margin: "0 0 2px" }}>{m.name}</h3>
                <p style={{ fontSize: "11px", fontWeight: 500, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
                  {m.title}
                </p>
                <div style={{
                  display: "inline-block",
                  backgroundColor: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                  borderRadius: "12px",
                  padding: "2px 8px",
                  marginBottom: "12px"
                }}>
                  <span style={{ fontSize: "9px", fontWeight: 600, color: "#10b981", textTransform: "uppercase" }}>
                    Legal / Operations
                  </span>
                </div>
                <p style={{ fontSize: "13px", lineHeight: "1.5", color: "#94a3b8", margin: 0 }}>
                  {m.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TeamMarquee() {
  const doubled = [...MQ_DATA, ...MQ_DATA];
  return (
    <section style={{
      backgroundColor: "#040e1f",
      padding: "48px 0",
      borderTop: "1px solid rgba(255, 255, 255, 0.08)",
      borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
      overflow: "hidden",
      position: "relative"
    }}>
      <div style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: "120px",
        zIndex: 2,
        background: "linear-gradient(90deg, #040e1f, transparent)",
        pointerEvents: "none"
      }} />
      <div style={{
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: "120px",
        zIndex: 2,
        background: "linear-gradient(-90deg, #040e1f, transparent)",
        pointerEvents: "none"
      }} />

      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 24px", marginBottom: "24px" }}>
        <h4 style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: "11px",
          fontWeight: 600,
          color: "#10b981",
          textTransform: "uppercase",
          letterSpacing: "0.15em",
          margin: 0,
          textAlign: "center"
        }}>
          Everyone Building SCAFIS
        </h4>
      </div>

      <div style={{ position: "relative" }}>
        <div className="lp-mq-track" style={{ display: "flex", gap: "16px", width: "max-content" }}>
          {doubled.map((p, idx) => (
            <div
              key={idx}
              style={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 16px",
                backgroundColor: "rgba(255, 255, 255, 0.025)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "16px",
                boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)"
              }}
            >
              <div style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                backgroundColor: "rgba(16, 185, 129, 0.1)",
                border: `1.5px solid ${p.accent}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10px",
                fontWeight: 600,
                color: p.accent
              }}>
                {p.initials}
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#ffffff", lineHeight: "1.2" }}>{p.name}</span>
                <span style={{ fontSize: "9px", fontWeight: 500, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{p.role}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN CONTAINER
═══════════════════════════════════════════════════════════════════════════ */
export default function LeadershipPage() {
  return (
    <M.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.42 }}
      style={{ backgroundColor: "#030b1a", minHeight: "100vh" }}
    >
      <Navbar />
      <Hero />
      <FounderSpotlight />
      <AdvisorsSection />
      <CEOSpotlight />
      <TeamSection />
      <TeamMarquee />
      <Footer />
    </M.div>
  );
}
