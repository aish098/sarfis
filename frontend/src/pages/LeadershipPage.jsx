/**
 * LeadershipPage.jsx  –  faithful to the reference image
 * src/pages/LeadershipPage.jsx
 *
 * Uses: React, Tailwind CSS (for utility classes)
 * Fonts: Montserrat + Open Sans (auto-injected)
 * No extra npm packages needed.
 */

import { useEffect, useRef, useState } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { motion as Motion } from "framer-motion";

/* ─── scroll-reveal ────────────────────────────────────────────────────── */
function useReveal() {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVis(true); io.disconnect(); } },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, vis];
}

function Reveal({ children, delay = 0, tx = 0, ty = 24, style = {}, className = "" }) {
  const [ref, vis] = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: vis ? 1 : 0,
        transform: vis ? "none" : `translate(${tx}px,${ty}px)`,
        transition: `opacity .6s ease ${delay}s, transform .6s cubic-bezier(.22,1,.36,1) ${delay}s`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ─── avatar ────────────────────────────────────────────────────────────── */
function Avatar({ initials, size = 80, dark = true, border = "#10b981" }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: dark ? "linear-gradient(145deg,#1c2d4a,#0e1628)" : "linear-gradient(145deg,#e2e8f0,#cbd5e1)",
        border: `3px solid ${border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Montserrat',sans-serif",
        fontWeight: 800, fontSize: size * 0.27,
        color: dark ? "#06b6d4" : "#1a2540",
        flexShrink: 0, letterSpacing: "0.04em",
        boxShadow: `0 4px 24px ${border}33`,
      }}
    >
      {initials}
    </div>
  );
}

/* ─── data ──────────────────────────────────────────────────────────────── */
const TEAM = [
  { initials: "BA", name: "Farhan", role: "Legal Advisor", dept: "eng" },
  { initials: "HT", name: "?????", role: "?????", dept: "eng" },
  { initials: "SM", name: "?????", role: "?????", dept: "eng" },
  { initials: "UA", name: "?????", role: "?????", dept: "eng" },
  { initials: "FN", name: "?????", role: "?????", dept: "fin" },
  { initials: "ZK", name: "?????", role: "?????", dept: "fin" },
];

/* ═══════════════════════════════════════════════════════════════════════
   HERO  –  dark navy bg · left: portrait panel · right: bio text
══════════════════════════════════════════════════════════════════════ */
function Hero() {
  return (
    <section style={{ background: "#030b1a", position: "relative", overflow: "hidden", paddingTop: "80px" }}>

      {/* top gold line */}
      <div style={{ height: 3, background: "linear-gradient(90deg,#10b981,#06b6d4,#10b981)" }} />

      <div style={{ display: "flex", flexWrap: "wrap", minHeight: 480 }}>

        {/* ── LEFT: portrait ── */}
        <div style={{
          flex: "0 0 320px", minWidth: 240,
          background: "linear-gradient(150deg,#1b2a44 0%,#030b1a 100%)",
          display: "flex", flexDirection: "column",
          alignItems: "center", padding: "36px 28px 0",
          position: "relative", overflow: "hidden",
        }}>

          {/* dot-grid texture */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.06, pointerEvents: "none" }}>
            <defs>
              <pattern id="g1" width="26" height="26" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.4" fill="#10b981" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#g1)" />
          </svg>

          {/* tag */}
          <Reveal delay={0.05} ty={-10}>
            <p style={{
              fontFamily: "'Montserrat',sans-serif", fontSize: 10, fontWeight: 700,
              letterSpacing: "0.3em", textTransform: "uppercase",
              background: "linear-gradient(90deg,#10b981,#06b6d4)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              marginBottom: 24,
            }}>
              Chairman &amp; Founder
            </p>
          </Reveal>

          {/* avatar */}
          <Reveal delay={0.12} ty={28}>
            <Avatar initials="RZ" size={172} border="#10b981" dark />
          </Reveal>

          {/* gold bottom accent */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            height: 5, background: "linear-gradient(90deg,transparent,#10b981,transparent)",
          }} />
        </div>

        {/* ── RIGHT: text ── */}
        <div style={{
          flex: 1, minWidth: 280,
          background: "#060d24",
          padding: "40px 48px 40px 40px",
          display: "flex", flexDirection: "column", justifyContent: "center",
          position: "relative", overflow: "hidden",
        }}>

          {/* faint circuit lines (top-right) */}
          <svg style={{ position: "absolute", top: 0, right: 0, width: 200, height: 260, opacity: 0.07, pointerEvents: "none" }}>
            <polyline points="60,0 60,80 160,80 160,160 200,160" fill="none" stroke="#10b981" strokeWidth="1.2" />
            <polyline points="100,0 100,40 180,40 180,120" fill="none" stroke="#10b981" strokeWidth="1.2" />
            <circle cx="60" cy="80" r="3" fill="#10b981" />
            <circle cx="160" cy="160" r="3" fill="#10b981" />
            <circle cx="100" cy="40" r="3" fill="#10b981" />
          </svg>

          <Reveal delay={0.1} tx={-20} ty={0}>
            <h1 style={{
              fontFamily: "'Montserrat',sans-serif",
              fontSize: "clamp(16px,2.6vw,28px)", fontWeight: 900,
              color: "#f8fafc", letterSpacing: "0.07em",
              textTransform: "uppercase", lineHeight: 1.2, marginBottom: 24,
            }}>
              Rana Muhammad Zain ul Abideen
            </h1>
          </Reveal>

          {/* gold rule */}
          <div style={{ width: 44, height: 3, background: "#10b981", borderRadius: 2, marginBottom: 24 }} />

          <Reveal delay={0.18}>
            <p style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 9.5, fontWeight: 700, color: "#10b981", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 8 }}>
              Bibliography
            </p>
            <p style={{ fontFamily: "'Open Sans',sans-serif", fontSize: 13, color: "#94a3b8", lineHeight: 1.75, marginBottom: 22 }}>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
            </p>
          </Reveal>

          <Reveal delay={0.26}>
            <p style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 9.5, fontWeight: 700, color: "#10b981", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 8 }}>
              Founder's Mission for SARFIS
            </p>
            <p style={{ fontFamily: "'Open Sans',sans-serif", fontSize: 13, color: "#94a3b8", lineHeight: 1.75 }}>
              Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
            </p>
          </Reveal>

          {/* scroll caret */}
          <div style={{ marginTop: 32, display: "flex", justifyContent: "center" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              border: "1.5px solid #10b98155",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="10" height="10" viewBox="0 0 10 10">
                <polyline points="2,3 5,7 8,3" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Mentor Card ─── */
function MentorCard({ name, role, desc, initials, border }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: "#fff",
        border: `1.5px solid ${hov ? border : "#e2e8f0"}`,
        borderRadius: 12, padding: "28px 20px",
        display: "flex", flexDirection: "column", alignItems: "center",
        textAlign: "center", gap: 12, cursor: "default",
        transition: "border-color .25s, box-shadow .25s",
        boxShadow: hov ? `0 8px 32px ${border}2a` : "0 2px 10px rgba(0,0,0,0.07)",
        height: "100%", boxSizing: "border-box",
      }}
    >
      <Avatar initials={initials} size={84} border={border} dark />

      <div>
        <p style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 11.5, fontWeight: 800, color: "#1a2540", textTransform: "uppercase", letterSpacing: "0.05em", lineHeight: 1.35, marginBottom: 5 }}>
          {name}
        </p>
        <p style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 8.5, fontWeight: 700, color: border, letterSpacing: "0.2em", textTransform: "uppercase" }}>
          {role}
        </p>
      </div>

      <div style={{ width: 28, height: 2, background: border, borderRadius: 1 }} />

      <p style={{ fontFamily: "'Open Sans',sans-serif", fontSize: 12, color: "#64748b", lineHeight: 1.7 }}>
        {desc}
      </p>
    </div>
  );
}

function Mentors() {
  return (
    <section style={{ background: "#eef0f4", padding: "56px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        <Reveal>
          <h2 style={{
            fontFamily: "'Montserrat',sans-serif", fontSize: 20, fontWeight: 800,
            color: "#1a2540", textAlign: "center", letterSpacing: "0.15em",
            textTransform: "uppercase", marginBottom: 44,
          }}>
            Mentors and Academic Advisors
          </h2>
        </Reveal>

        <div className="flex flex-col md:flex-row items-stretch gap-8 md:gap-0">

          {/* card 1 */}
          <Reveal delay={0.08} tx={-24} ty={0} className="flex-1">
            <MentorCard
              initials="MS" border="#10b981"
              name="Professor Mohammad Saad Anwar"
              role="Taxation Lawyer"
              desc="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."
            />
          </Reveal>

          {/* circuit connector */}
          <div className="hidden md:flex items-center px-1 flex-shrink-0">
            <svg width="120" height="56" viewBox="0 0 120 56">
              <line x1="0" y1="28" x2="32" y2="28" stroke="#10b981" strokeWidth="1.5" strokeDasharray="5 3" />
              <rect x="32" y="15" width="56" height="26" rx="6" fill="#1a2540" stroke="#10b981" strokeWidth="1.5" />
              <text x="60" y="25" textAnchor="middle" fontSize="6" fill="#06b6d4" fontFamily="'Montserrat',sans-serif" fontWeight="800" letterSpacing="0.4">CONNECTION</text>
              <text x="60" y="33" textAnchor="middle" fontSize="6" fill="#06b6d4" fontFamily="'Montserrat',sans-serif" fontWeight="600" letterSpacing="0.4">TO CENTRE</text>
              <line x1="88" y1="28" x2="120" y2="28" stroke="#10b981" strokeWidth="1.5" strokeDasharray="5 3" />
              <circle cx="0" cy="28" r="3.5" fill="#10b981" />
              <circle cx="120" cy="28" r="3.5" fill="#10b981" />
            </svg>
          </div>

          {/* card 2 */}
          <Reveal delay={0.16} tx={24} ty={0} className="flex-1">
            <MentorCard
              initials="MR" border="#06b6d4"
              name="Professor Muhammed Rehan Anjum"
              role="Accounting Specialist"
              desc="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."
            />
          </Reveal>
        </div>

        {/* connector label */}
        <Reveal delay={0.25}>
          <div style={{ textAlign: "center", marginTop: 14 }}>
            <span style={{
              fontFamily: "'Montserrat',sans-serif", fontSize: 8, fontWeight: 600,
              color: "#94a3b8", letterSpacing: "0.2em", textTransform: "uppercase",
            }}>
              — Connection to Centre Links —
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function CEO() {
  return (
    <section style={{ background: "#eef0f4", padding: "0 24px 56px" }}>
      <div style={{
        maxWidth: 900, margin: "0 auto",
        borderRadius: 14, overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        display: "flex", flexWrap: "wrap",
      }}>

        {/* LEFT dark panel */}
        <div style={{
          flex: "0 0 260px", minWidth: 200,
          background: "linear-gradient(155deg,#1b2a44,#030b1a)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "40px 24px", gap: 14,
          position: "relative", overflow: "hidden",
        }}>
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.06, pointerEvents: "none" }}>
            <defs>
              <pattern id="g2" width="22" height="22" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.2" fill="#10b981" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#g2)" />
          </svg>

          <Reveal delay={0.1} ty={16}>
            <Avatar initials="AK" size={110} border="#10b981" dark />
          </Reveal>

          <Reveal delay={0.18}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 17, fontWeight: 900, color: "#fff", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                Ayesha Kashif
              </p>
              <p style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 8.5, fontWeight: 700, color: "#10b981", letterSpacing: "0.22em", textTransform: "uppercase" }}>
                CEO &amp; Co-Founder
              </p>
            </div>
          </Reveal>
        </div>

        {/* RIGHT white panel */}
        <div style={{ flex: 1, minWidth: 260, background: "#fff", padding: "36px 36px" }}>
          <Reveal delay={0.1} tx={16} ty={0}>
            <p style={{
              fontFamily: "'Montserrat',sans-serif", fontSize: 9.5, fontWeight: 700,
              color: "#10b981", letterSpacing: "0.25em", textTransform: "uppercase",
              marginBottom: 18,
            }}>
              CEO's Strategic Operational Vision
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              {[
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna.",
                "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
                "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: "#10b981", flexShrink: 0, marginTop: 5,
                  }} />
                  <p style={{ fontFamily: "'Open Sans',sans-serif", fontSize: 13, color: "#374151", lineHeight: 1.7, margin: 0 }}>
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function TeamMemberNode({ member, delay }) {
  const [hov, setHov] = useState(false);
  const isEng = member.dept === "eng";
  const ring = isEng ? "#1a2540" : "#10b981";

  return (
    <Reveal delay={delay} ty={14} className="flex-1 flex justify-center">
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: 8, cursor: "default",
        }}
      >
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: hov ? ring : "#1a2540",
          border: `3px solid ${hov ? "#10b981" : ring}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Montserrat',sans-serif", fontWeight: 800,
          fontSize: 15, color: "#06b6d4",
          transition: "all .22s",
          boxShadow: hov ? `0 0 0 4px ${ring}33` : "none",
          position: "relative", zIndex: 1,
        }}>
          {member.initials}
        </div>

        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", marginTop: -4 }} />

        <div style={{ textAlign: "center" }}>
          <p style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 9.5, fontWeight: 700, color: "#1a2540", marginBottom: 2, letterSpacing: "0.03em" }}>
            {member.name}
          </p>
          <p style={{ fontFamily: "'Open Sans',sans-serif", fontSize: 10, color: "#64748b" }}>
            {member.role}
          </p>
        </div>
      </div>
    </Reveal>
  );
}

function Team() {
  return (
    <section style={{ background: "#fff", padding: "52px 24px 72px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        <Reveal>
          <h2 style={{
            fontFamily: "'Montserrat',sans-serif", fontSize: 20, fontWeight: 800,
            color: "#1a2540", textAlign: "center", letterSpacing: "0.15em",
            textTransform: "uppercase", marginBottom: 12,
          }}>
            Team Members
          </h2>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="flex justify-between items-center mb-6 px-2">
            <div className="flex items-center gap-2">
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#1a2540", border: "2.5px solid #10b981" }} />
              <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 9, fontWeight: 700, color: "#1a2540", letterSpacing: "0.28em", textTransform: "uppercase" }}>
                Engineering
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 9, fontWeight: 700, color: "#1a2540", letterSpacing: "0.28em", textTransform: "uppercase" }}>
                Finance Modules
              </span>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10b981", border: "2.5px solid #1a2540" }} />
            </div>
          </div>
        </Reveal>

        <div style={{ position: "relative" }}>
          <div style={{
            position: "absolute", top: 32, left: "6%", right: "6%",
            height: 2, background: "linear-gradient(90deg,#1a2540,#10b981 50%,#1a2540)",
            zIndex: 0,
          }} />

          <div style={{
            position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)",
            background: "#1a2540", border: "1.5px solid #10b981",
            borderRadius: 6, padding: "4px 10px", zIndex: 3,
            textAlign: "center",
          }}>
            <p style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 7.5, fontWeight: 700, color: "#10b981", letterSpacing: "0.12em", margin: 0 }}>SARFIS</p>
            <p style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 6.5, color: "#06b6d4", letterSpacing: "0.1em", margin: 0 }}>TEAM MEMBERS</p>
          </div>

          <div className="flex flex-wrap md:flex-nowrap items-start relative z-10 gap-y-8">
            {TEAM.map((m, i) => (
              <TeamMemberNode key={m.initials} member={m} delay={i * 0.07} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LeadershipPage() {
  useEffect(() => {
    if (!document.getElementById("lp-fonts")) {
      const l = document.createElement("link");
      l.id = "lp-fonts";
      l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&family=Open+Sans:wght@400;600&display=swap";
      document.head.appendChild(l);
    }
  }, []);

  return (
    <Motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-[#030b1a] min-h-screen"
    >
      <Navbar />
      <div className="pt-2">
        <Hero />
        <Mentors />
        <CEO />
        <Team />
      </div>
      <Footer />
    </Motion.div>
  );
}
