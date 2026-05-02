/**
 * LeadershipPage.jsx  —  SCAFIS Dark Theme Redesign
 *
 * Color System:
 *   Main bg       #1a1f2e
 *   Card bg       #12162a
 *   Borders       #2a3044
 *   Accent        #6366f1 / #4f46e5
 *   Text primary  #ffffff / #f1f5f9
 *   Text muted    #94a3b8 / #6b7280
 *
 * Fonts: Plus Jakarta Sans (display) + IBM Plex Mono (mono accents)
 * Requires: framer-motion (already in project)
 */

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

/* ─── design tokens ───────────────────────────────────────────────────────── */
const C = {
  bg:          "#1a1f2e",
  card:        "#12162a",
  cardDeep:    "#0d1020",
  border:      "#2a3044",
  borderSub:   "#1e2438",
  accent:      "#6366f1",
  accentDark:  "#4f46e5",
  accentGlow:  "rgba(99,102,241,0.15)",
  accentGlow2: "rgba(99,102,241,0.08)",
  accentText:  "#818cf8",
  accentDim:   "rgba(99,102,241,0.12)",
  textPri:     "#f1f5f9",
  textSec:     "#94a3b8",
  textMut:     "#4b5563",
  cyan:        "#22d3ee",
  cyanDim:     "rgba(34,211,238,0.1)",
};

const sans = { fontFamily: "'Plus Jakarta Sans', sans-serif" };
const mono = { fontFamily: "'IBM Plex Mono', monospace" };

/* ─── font injection ────────────────────────────────────────────────────────── */
if (typeof document !== "undefined" && !document.getElementById("lp-gf2")) {
  const l = document.createElement("link");
  l.id = "lp-gf2"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500;600&display=swap";
  document.head.appendChild(l);
}

/* ─── scroll reveal hook ───────────────────────────────────────────────────── */
function useReveal(threshold = 0.1) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVis(true); io.disconnect(); } },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, vis];
}

function Reveal({ children, delay = 0, tx = 0, ty = 20, className = "", style = {} }) {
  const [ref, vis] = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: vis ? 1 : 0,
        transform: vis ? "none" : `translate(${tx}px,${ty}px)`,
        transition: `opacity .65s ease ${delay}s, transform .65s cubic-bezier(.22,1,.36,1) ${delay}s`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ─── section label ─────────────────────────────────────────────────────────── */
function SectionLabel({ children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <div style={{ width: 24, height: 1.5, background: C.accent }} />
      <span style={{
        ...mono, fontSize: 10, fontWeight: 600, color: C.accentText,
        letterSpacing: "0.22em", textTransform: "uppercase",
      }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: C.borderSub }} />
    </div>
  );
}

/* ─── avatar ─────────────────────────────────────────────────────────────────── */
function Avatar({ initials, size = 80, accent = C.accent, glow = C.accentGlow }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: `radial-gradient(circle at 35% 35%, #1e2448, ${C.cardDeep})`,
        border: `2px solid ${accent}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        ...sans, fontWeight: 800,
        fontSize: size * 0.28, color: accent,
        letterSpacing: "0.05em", flexShrink: 0,
        boxShadow: `0 0 0 4px ${glow}, 0 8px 32px ${glow}`,
      }}
    >
      {initials}
    </div>
  );
}

/* ─── data ───────────────────────────────────────────────────────────────────── */
const TEAM = [
  { initials: "FA", name: "Farhan",  role: "Legal Advisor",      dept: "eng" },
  { initials: "HT", name: "?????",   role: "?????",              dept: "eng" },
  { initials: "SM", name: "?????",   role: "?????",              dept: "eng" },
  { initials: "UA", name: "?????",   role: "?????",              dept: "eng" },
  { initials: "FN", name: "?????",   role: "?????",              dept: "fin" },
  { initials: "ZK", name: "?????",   role: "?????",              dept: "fin" },
];

/* ════════════════════════════════════════════════════════════════════════════
   HERO
════════════════════════════════════════════════════════════════════════════ */
function Hero() {
  return (
    <section
      style={{
        background: C.bg,
        position: "relative",
        overflow: "hidden",
        paddingTop: 80,
      }}
    >
      {/* top accent bar */}
      <div style={{
        height: 3,
        background: `linear-gradient(90deg, ${C.accent}, ${C.cyan}, ${C.accent})`,
      }} />

      {/* ambient glow blobs */}
      <div style={{
        position: "absolute", top: 60, left: "35%",
        width: 500, height: 400, borderRadius: "50%",
        background: C.accentGlow, filter: "blur(80px)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: 100, right: "5%",
        width: 280, height: 280, borderRadius: "50%",
        background: C.cyanDim, filter: "blur(60px)",
        pointerEvents: "none",
      }} />

      <div style={{ display: "flex", flexWrap: "wrap", minHeight: 520 }}>

        {/* ── LEFT portrait panel ── */}
        <div style={{
          flex: "0 0 340px", minWidth: 260,
          background: `linear-gradient(160deg, #151b32 0%, ${C.cardDeep} 100%)`,
          display: "flex", flexDirection: "column",
          alignItems: "center", padding: "44px 32px 0",
          position: "relative", overflow: "hidden",
          borderRight: `1px solid ${C.border}`,
        }}>
          {/* indigo dot grid */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.07, pointerEvents: "none" }}>
            <defs>
              <pattern id="dp1" width="28" height="28" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill={C.accent} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dp1)" />
          </svg>

          {/* circuit lines */}
          <svg style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 200, opacity: 0.1, pointerEvents: "none" }}>
            <polyline points="0,180 60,180 60,120 120,120 120,80 200,80" fill="none" stroke={C.accent} strokeWidth="1" />
            <polyline points="0,160 40,160 40,100 100,100" fill="none" stroke={C.cyan} strokeWidth="1" />
            <circle cx="60" cy="120" r="3" fill={C.accent} />
            <circle cx="120" cy="80" r="3" fill={C.accent} />
            <circle cx="100" cy="100" r="2.5" fill={C.cyan} />
          </svg>

          <Reveal delay={0.05} ty={-10}>
            <div style={{
              background: C.accentDim,
              border: `1px solid ${C.accent}44`,
              borderRadius: 20, padding: "4px 14px",
              marginBottom: 28,
            }}>
              <span style={{
                ...mono, fontSize: 9, fontWeight: 600,
                letterSpacing: "0.28em", textTransform: "uppercase",
                color: C.accentText,
              }}>
                Chairman &amp; Founder
              </span>
            </div>
          </Reveal>

          <Reveal delay={0.12} ty={24}>
            <Avatar initials="RZ" size={168} accent={C.accent} glow={C.accentGlow} />
          </Reveal>

          {/* tags below avatar */}
          <Reveal delay={0.2} ty={12} style={{ marginTop: 28, width: "100%" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {["Chartered Accountant", "ERP Architect", "AI Decision Systems"].map(t => (
                <div key={t} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: C.accentGlow2,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: "7px 12px",
                }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.accent, flexShrink: 0 }} />
                  <span style={{ ...sans, fontSize: 11, color: C.textSec }}>{t}</span>
                </div>
              ))}
            </div>
          </Reveal>

          {/* bottom glow bar */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            height: 4,
            background: `linear-gradient(90deg, transparent, ${C.accent}, transparent)`,
          }} />
        </div>

        {/* ── RIGHT text panel ── */}
        <div style={{
          flex: 1, minWidth: 280,
          background: `linear-gradient(160deg, #13172a 0%, ${C.bg} 100%)`,
          padding: "48px 52px 48px 44px",
          display: "flex", flexDirection: "column", justifyContent: "center",
          position: "relative", overflow: "hidden",
        }}>
          {/* decorative circuit lines top-right */}
          <svg style={{ position: "absolute", top: 0, right: 0, width: 220, height: 280, opacity: 0.07, pointerEvents: "none" }}>
            <polyline points="80,0 80,80 180,80 180,160 220,160" fill="none" stroke={C.accent} strokeWidth="1.2" />
            <polyline points="130,0 130,50 200,50 200,140" fill="none" stroke={C.cyan} strokeWidth="1.2" />
            <circle cx="80" cy="80" r="3" fill={C.accent} />
            <circle cx="180" cy="160" r="3" fill={C.accent} />
            <circle cx="130" cy="50" r="3" fill={C.cyan} />
            <circle cx="200" cy="140" r="3" fill={C.cyan} />
          </svg>

          <Reveal delay={0.08} ty={0} tx={-20}>
            <SectionLabel>Leadership</SectionLabel>
            <h1 style={{
              ...sans,
              fontSize: "clamp(18px, 2.8vw, 30px)",
              fontWeight: 900, color: C.textPri,
              letterSpacing: "0.05em", textTransform: "uppercase",
              lineHeight: 1.2, margin: "12px 0 20px",
            }}>
              Rana Muhammad Zain ul Abideen
            </h1>
          </Reveal>

          {/* accent rule */}
          <div style={{
            width: 48, height: 3, borderRadius: 2, marginBottom: 28,
            background: `linear-gradient(90deg, ${C.accent}, ${C.accentDark})`,
          }} />

          <Reveal delay={0.18}>
            <div style={{
              background: C.accentGlow2,
              border: `1px solid ${C.border}`,
              borderRadius: 12, padding: "18px 20px",
              marginBottom: 16,
            }}>
              <p style={{ ...mono, fontSize: 9, fontWeight: 600, color: C.accentText, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 8 }}>
                Bibliography
              </p>
              <p style={{ ...sans, fontSize: 13, color: C.textSec, lineHeight: 1.8, margin: 0 }}>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.26}>
            <div style={{
              background: C.accentGlow2,
              border: `1px solid ${C.border}`,
              borderRadius: 12, padding: "18px 20px",
            }}>
              <p style={{ ...mono, fontSize: 9, fontWeight: 600, color: C.accentText, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 8 }}>
                Founder's Mission for SARFIS
              </p>
              <p style={{ ...sans, fontSize: 13, color: C.textSec, lineHeight: 1.8, margin: 0 }}>
                Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
              </p>
            </div>
          </Reveal>

          {/* scroll caret */}
          <div style={{ marginTop: 36, display: "flex", justifyContent: "center" }}>
            <motion.div
              animate={{ y: [0, 5, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              style={{
                width: 30, height: 30, borderRadius: "50%",
                border: `1.5px solid ${C.accent}44`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10">
                <polyline points="2,3 5,7 8,3" fill="none" stroke={C.accentText} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MENTOR CARD
════════════════════════════════════════════════════════════════════════════ */
function MentorCard({ name, role, desc, initials, accent = C.accent, glow = C.accentGlow }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov
          ? `linear-gradient(160deg, #161b34, ${C.cardDeep})`
          : C.card,
        border: `1.5px solid ${hov ? accent : C.border}`,
        borderRadius: 16, padding: "28px 24px",
        display: "flex", flexDirection: "column", alignItems: "center",
        textAlign: "center", gap: 14, cursor: "default",
        transition: "all .3s",
        boxShadow: hov ? `0 12px 40px ${glow}` : "none",
        height: "100%", boxSizing: "border-box",
        position: "relative", overflow: "hidden",
      }}
    >
      {/* top accent strip */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: hov
          ? `linear-gradient(90deg, transparent, ${accent}, transparent)`
          : "transparent",
        transition: "all .3s",
      }} />

      <Avatar initials={initials} size={84} accent={accent} glow={glow} />

      <div>
        <p style={{ ...sans, fontSize: 12, fontWeight: 800, color: C.textPri, textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1.4, marginBottom: 6 }}>
          {name}
        </p>
        <span style={{
          ...mono, fontSize: 9, fontWeight: 600, color: accent,
          letterSpacing: "0.18em", textTransform: "uppercase",
          background: C.accentDim,
          border: `1px solid ${accent}33`,
          padding: "3px 10px", borderRadius: 12,
        }}>
          {role}
        </span>
      </div>

      <div style={{ width: 32, height: 1.5, background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />

      <p style={{ ...sans, fontSize: 12, color: C.textSec, lineHeight: 1.75 }}>
        {desc}
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MENTORS SECTION
════════════════════════════════════════════════════════════════════════════ */
function Mentors() {
  return (
    <section style={{ background: C.bg, padding: "72px 24px", borderTop: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        <Reveal>
          <SectionLabel>Guidance</SectionLabel>
          <h2 style={{
            ...sans, fontSize: 22, fontWeight: 800,
            color: C.textPri, letterSpacing: "0.1em",
            textTransform: "uppercase", margin: "10px 0 48px",
          }}>
            Mentors &amp; Academic Advisors
          </h2>
        </Reveal>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 0, alignItems: "stretch" }}>

          {/* Card 1 */}
          <Reveal delay={0.08} tx={-28} ty={0} style={{ flex: "1 1 260px" }}>
            <MentorCard
              initials="MS"
              accent={C.accent}
              glow={C.accentGlow}
              name="Professor Mohammad Saad Anwar"
              role="Taxation Lawyer"
              desc="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip."
            />
          </Reveal>

          {/* Circuit connector (hidden on mobile) */}
          <div style={{
            display: "flex", alignItems: "center",
            padding: "0 6px", flexShrink: 0,
          }}>
            <svg width="120" height="60" viewBox="0 0 120 60">
              <line x1="0" y1="30" x2="36" y2="30" stroke={C.accent} strokeWidth="1.5" strokeDasharray="5 3" />
              <rect x="36" y="17" width="48" height="26" rx="6" fill={C.card} stroke={C.accent} strokeWidth="1.2" />
              <text x="60" y="27" textAnchor="middle" fontSize="5.5" fill={C.accentText} fontFamily="'IBM Plex Mono',monospace" fontWeight="700" letterSpacing="0.3">CONNECTION</text>
              <text x="60" y="35.5" textAnchor="middle" fontSize="5.5" fill={C.cyan} fontFamily="'IBM Plex Mono',monospace" fontWeight="500" letterSpacing="0.3">TO CENTRE</text>
              <line x1="84" y1="30" x2="120" y2="30" stroke={C.accent} strokeWidth="1.5" strokeDasharray="5 3" />
              <circle cx="0" cy="30" r="3.5" fill={C.accent} />
              <circle cx="120" cy="30" r="3.5" fill={C.accent} />
            </svg>
          </div>

          {/* Card 2 */}
          <Reveal delay={0.16} tx={28} ty={0} style={{ flex: "1 1 260px" }}>
            <MentorCard
              initials="MR"
              accent={C.cyan}
              glow={C.cyanDim}
              name="Professor Muhammed Rehan Anjum"
              role="Accounting Specialist"
              desc="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip."
            />
          </Reveal>
        </div>

        <Reveal delay={0.28}>
          <div style={{ textAlign: "center", marginTop: 18 }}>
            <span style={{
              ...mono, fontSize: 8.5, fontWeight: 500,
              color: C.textMut, letterSpacing: "0.2em", textTransform: "uppercase",
            }}>
              — Connection to Centre Links —
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   CEO SECTION
════════════════════════════════════════════════════════════════════════════ */
function CEO() {
  return (
    <section style={{ background: C.bg, padding: "0 24px 72px", borderTop: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 960, margin: "0 auto", paddingTop: 72 }}>

        <Reveal>
          <SectionLabel>Executive Leadership</SectionLabel>
          <h2 style={{
            ...sans, fontSize: 22, fontWeight: 800,
            color: C.textPri, letterSpacing: "0.1em",
            textTransform: "uppercase", margin: "10px 0 32px",
          }}>
            CEO Spotlight
          </h2>
        </Reveal>

        <div style={{
          display: "flex", flexWrap: "wrap",
          borderRadius: 18, overflow: "hidden",
          border: `1px solid ${C.border}`,
          boxShadow: `0 24px 80px rgba(0,0,0,0.4), 0 0 0 1px ${C.accentGlow}`,
        }}>

          {/* LEFT dark panel */}
          <div style={{
            flex: "0 0 280px", minWidth: 220,
            background: `linear-gradient(160deg, #151b32, ${C.cardDeep})`,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "48px 28px", gap: 16,
            position: "relative", overflow: "hidden",
            borderRight: `1px solid ${C.border}`,
          }}>
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.06, pointerEvents: "none" }}>
              <defs>
                <pattern id="dp2" width="24" height="24" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.3" fill={C.accent} />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dp2)" />
            </svg>

            {/* glow orb */}
            <div style={{
              position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)",
              width: 160, height: 160, borderRadius: "50%",
              background: C.accentGlow, filter: "blur(40px)",
              pointerEvents: "none",
            }} />

            <Reveal delay={0.1} ty={16}>
              <Avatar initials="AK" size={116} accent={C.accent} glow={C.accentGlow} />
            </Reveal>

            <Reveal delay={0.18}>
              <div style={{ textAlign: "center", position: "relative" }}>
                <p style={{ ...sans, fontSize: 18, fontWeight: 900, color: C.textPri, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                  Ayesha Kashif
                </p>
                <div style={{
                  display: "inline-flex", background: C.accentDim,
                  border: `1px solid ${C.accent}44`,
                  borderRadius: 14, padding: "4px 12px",
                }}>
                  <span style={{ ...mono, fontSize: 9, fontWeight: 600, color: C.accentText, letterSpacing: "0.2em", textTransform: "uppercase" }}>
                    CEO &amp; Co-Founder
                  </span>
                </div>
              </div>
            </Reveal>
          </div>

          {/* RIGHT vision panel */}
          <div style={{
            flex: 1, minWidth: 280,
            background: C.card,
            padding: "44px 40px",
          }}>
            <Reveal delay={0.12} tx={16} ty={0}>
              <p style={{
                ...mono, fontSize: 9, fontWeight: 600, color: C.accentText,
                letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 24,
              }}>
                CEO's Strategic Operational Vision
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna.",
                  "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
                  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex", gap: 14, alignItems: "flex-start",
                      padding: "14px 16px",
                      background: C.accentGlow2,
                      border: `1px solid ${C.borderSub}`,
                      borderRadius: 10,
                      transition: "border-color .2s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = C.accent + "44"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = C.borderSub}
                  >
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
                      background: C.accentDim, border: `1px solid ${C.accent}44`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ ...mono, fontSize: 9, fontWeight: 700, color: C.accentText }}>{i + 1}</span>
                    </div>
                    <p style={{ ...sans, fontSize: 13, color: C.textSec, lineHeight: 1.75, margin: 0 }}>
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TEAM SECTION
════════════════════════════════════════════════════════════════════════════ */
function TeamNode({ member, index }) {
  const [hov, setHov] = useState(false);
  const accent = member.dept === "eng" ? C.accent : C.cyan;

  return (
    <Reveal
      delay={index * 0.07}
      ty={14}
      style={{ flex: 1, display: "flex", justifyContent: "center", minWidth: 80 }}
    >
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: 8, cursor: "default",
        }}
      >
        {/* avatar ring */}
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: hov
            ? `radial-gradient(circle at 35% 35%, #1e2448, ${C.cardDeep})`
            : C.card,
          border: `2px solid ${hov ? accent : C.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          ...sans, fontWeight: 800, fontSize: 14, color: hov ? accent : C.textSec,
          transition: "all .22s",
          boxShadow: hov ? `0 0 0 4px ${accent}22, 0 8px 24px ${accent}22` : "none",
          position: "relative", zIndex: 2,
        }}>
          {member.initials}
        </div>

        {/* connector dot */}
        <div style={{
          width: 7, height: 7, borderRadius: "50%",
          background: hov ? accent : C.border,
          marginTop: -4, zIndex: 3, position: "relative",
          transition: "background .22s",
          boxShadow: hov ? `0 0 8px ${accent}` : "none",
        }} />

        <div style={{ textAlign: "center" }}>
          <p style={{ ...sans, fontSize: 9.5, fontWeight: 700, color: hov ? C.textPri : C.textSec, marginBottom: 2, transition: "color .2s" }}>
            {member.name}
          </p>
          <p style={{ ...sans, fontSize: 10, color: C.textMut }}>
            {member.role}
          </p>
        </div>
      </div>
    </Reveal>
  );
}

function Team() {
  return (
    <section style={{ background: C.card, padding: "72px 24px 88px", borderTop: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        <Reveal>
          <SectionLabel>The Team</SectionLabel>
          <h2 style={{
            ...sans, fontSize: 22, fontWeight: 800,
            color: C.textPri, letterSpacing: "0.1em",
            textTransform: "uppercase", margin: "10px 0 12px",
          }}>
            Team Members
          </h2>
        </Reveal>

        {/* dept labels */}
        <Reveal delay={0.05}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            margin: "28px 0 12px", padding: "0 8px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 10, height: 10, borderRadius: "50%",
                background: C.accent, border: `2px solid ${C.accentDark}`,
                boxShadow: `0 0 6px ${C.accent}`,
              }} />
              <span style={{ ...mono, fontSize: 9, fontWeight: 600, color: C.textSec, letterSpacing: "0.28em", textTransform: "uppercase" }}>
                Engineering
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ ...mono, fontSize: 9, fontWeight: 600, color: C.textSec, letterSpacing: "0.28em", textTransform: "uppercase" }}>
                Finance Modules
              </span>
              <div style={{
                width: 10, height: 10, borderRadius: "50%",
                background: C.cyan, border: `2px solid #0e9db4`,
                boxShadow: `0 0 6px ${C.cyan}`,
              }} />
            </div>
          </div>
        </Reveal>

        {/* timeline + nodes */}
        <div style={{ position: "relative", marginTop: 8 }}>
          {/* horizontal line */}
          <div style={{
            position: "absolute", top: 32, left: "5%", right: "5%", height: 2,
            background: `linear-gradient(90deg, ${C.accent}, ${C.border} 40%, ${C.border} 60%, ${C.cyan})`,
            zIndex: 0,
          }} />

          {/* centre badge */}
          <div style={{
            position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)",
            background: C.cardDeep,
            border: `1.5px solid ${C.border}`,
            borderRadius: 8, padding: "5px 12px", zIndex: 4, textAlign: "center",
            boxShadow: `0 4px 16px rgba(0,0,0,0.4)`,
          }}>
            <p style={{ ...mono, fontSize: 7.5, fontWeight: 700, color: C.accentText, letterSpacing: "0.15em", margin: 0 }}>
              SARFIS
            </p>
            <p style={{ ...mono, fontSize: 6.5, color: C.cyan, letterSpacing: "0.12em", margin: 0 }}>
              TEAM MEMBERS
            </p>
          </div>

          {/* members */}
          <div style={{ display: "flex", alignItems: "flex-start", position: "relative", zIndex: 2, gap: 0 }}>
            {TEAM.map((m, i) => (
              <TeamNode key={m.initials} member={m} index={i} />
            ))}
          </div>
        </div>

        {/* member count */}
        <Reveal delay={0.4}>
          <div style={{ textAlign: "center", marginTop: 44 }}>
            <div style={{
              display: "inline-flex", gap: 28, alignItems: "center",
              background: C.bg, border: `1px solid ${C.border}`,
              borderRadius: 14, padding: "14px 32px",
            }}>
              {[
                { val: TEAM.filter(m => m.dept === "eng").length, label: "Engineering" },
                { val: TEAM.filter(m => m.dept === "fin").length, label: "Finance" },
                { val: TEAM.length + 2,                            label: "Total Members" },
              ].map((s, i, arr) => (
                <>
                  <div key={s.label} style={{ textAlign: "center" }}>
                    <p style={{ ...sans, fontSize: 22, fontWeight: 800, color: C.textPri, margin: 0 }}>{s.val}</p>
                    <p style={{ ...mono, fontSize: 9, color: C.textMut, letterSpacing: "0.15em", textTransform: "uppercase", margin: 0 }}>{s.label}</p>
                  </div>
                  {i < arr.length - 1 && (
                    <div key={`div-${i}`} style={{ width: 1, height: 36, background: C.border }} />
                  )}
                </>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   ROOT
════════════════════════════════════════════════════════════════════════════ */
export default function LeadershipPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      style={{ background: C.bg, minHeight: "100vh" }}
    >
      <Navbar />
      <Hero />
      <Mentors />
      <CEO />
      <Team />
      <Footer />
    </motion.div>
  );
}
