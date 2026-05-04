/**
 * LeadershipPage.jsx  —  SCAFIS Leadership (Restructured Final)
 *
 * EXACT SECTION ORDER:
 *  1. Hero
 *  2. Leadership Hierarchy  ← Team only (Farhan, TBA, TBA) — Founder/CEO removed from here
 *  3. Founder Spotlight     ← Full split-panel with stats + missions
 *  4. Advisory Board        ← Advisors (MS + MR premium cards)
 *  5. CEO Spotlight         ← Full split-panel with stats + missions
 *  6. Team Section          ← Team cards (Farhan, TBA, TBA)
 *  7. Team Marquee          ← Infinite scroll
 *
 * Color System: #1a1f2e / #12162a / #2a3044 / #6366f1 / #4f46e5
 */

import { useEffect, useRef, useState } from "react";
import { motion as M, useScroll, useTransform, AnimatePresence } from "framer-motion";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

/* ═══ DESIGN TOKENS ══════════════════════════════════════════════════════════ */
const C = {
  bg:       "#1a1f2e",
  card:     "#12162a",
  cardDeep: "#0b0e1a",
  border:   "#2a3044",
  borderLo: "#1e2438",
  accent:   "#6366f1",
  accentDk: "#4f46e5",
  accentLt: "#818cf8",
  accentGl: "rgba(99,102,241,0.15)",
  accentG2: "rgba(99,102,241,0.07)",
  accentG3: "rgba(99,102,241,0.04)",
  violet:   "#a78bfa",
  cyan:     "#22d3ee",
  cyanDim:  "rgba(34,211,238,0.12)",
  green:    "#10b981",
  greenDim: "rgba(16,185,129,0.12)",
  amber:    "#f59e0b",
  amberDim: "rgba(245,158,11,0.12)",
  textPri:  "#f1f5f9",
  textSec:  "#94a3b8",
  textDim:  "#475569",
};

/* ═══ KEYFRAMES ══════════════════════════════════════════════════════════════ */
if (typeof document !== "undefined" && !document.getElementById("lp-styles-v4")) {
  const s = document.createElement("style");
  s.id = "lp-styles-v4";
  s.textContent = `
    @keyframes lp-marquee    { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
    @keyframes lp-float      { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-10px) rotate(.7deg)} }
    @keyframes lp-pulse      { 0%{box-shadow:0 0 0 0 rgba(99,102,241,.45)} 70%{box-shadow:0 0 0 18px rgba(99,102,241,0)} 100%{box-shadow:0 0 0 0 rgba(99,102,241,0)} }
    @keyframes lp-shimmer    { 0%,100%{opacity:.4} 50%{opacity:1} }
    @keyframes lp-spin-slow  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    .lp-mq-track            { animation: lp-marquee 38s linear infinite; }
    .lp-mq-track:hover      { animation-play-state: paused; }
    .lp-float               { animation: lp-float 6s ease-in-out infinite; }
    .lp-pulse               { animation: lp-pulse 2.8s ease-out infinite; }
    .lp-shimmer             { animation: lp-shimmer 3s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
}

/* ═══ MOTION VARIANTS ════════════════════════════════════════════════════════ */
const vUp    = { hidden:{opacity:0,y:28}, show:{opacity:1,y:0,transition:{duration:.6,ease:[.22,1,.36,1]}} };
const vLeft  = { hidden:{opacity:0,x:-28},show:{opacity:1,x:0,transition:{duration:.6,ease:[.22,1,.36,1]}} };
const vRight = { hidden:{opacity:0,x:28}, show:{opacity:1,x:0,transition:{duration:.6,ease:[.22,1,.36,1]}} };
const vStagger = { show:{ transition:{ staggerChildren:.09 } } };

function FV({ children, v=vUp, delay=0, style={}, className="" }) {
  return (
    <M.div initial="hidden" whileInView="show"
      viewport={{once:true,amount:.08}}
      variants={v} transition={{delay}}
      style={style} className={className}>
      {children}
    </M.div>
  );
}

/* ═══ PARTICLE CANVAS ════════════════════════════════════════════════════════ */
function ParticleCanvas() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d");
    let raf, W, H, pts = [];
    const COLS = ["rgba(99,102,241,.5)","rgba(129,140,248,.4)","rgba(167,139,250,.3)","rgba(34,211,238,.2)"];
    const resize = () => { W = c.width = c.offsetWidth; H = c.height = c.offsetHeight; };
    const spawn  = () => ({
      x: Math.random()*W, y: Math.random()*H,
      r: Math.random()*1.5+.3,
      vx: (Math.random()-.5)*.18, vy: (Math.random()-.5)*.18,
      col: COLS[Math.floor(Math.random()*COLS.length)],
      a: Math.random()*.7+.2, life: 0,
      max: 200+Math.random()*220,
    });
    const init = () => { pts = Array.from({length:75}, spawn); };
    const draw = () => {
      ctx.clearRect(0,0,W,H);
      for (let i=0; i<pts.length; i++) for (let j=i+1; j<pts.length; j++) {
        const dx=pts[i].x-pts[j].x, dy=pts[i].y-pts[j].y, d=Math.hypot(dx,dy);
        if (d<105) { ctx.beginPath(); ctx.strokeStyle=`rgba(99,102,241,${.065*(1-d/105)})`; ctx.lineWidth=.4; ctx.moveTo(pts[i].x,pts[i].y); ctx.lineTo(pts[j].x,pts[j].y); ctx.stroke(); }
      }
      pts.forEach((p,idx) => {
        p.x+=p.vx; p.y+=p.vy; p.life++;
        if (p.x<0||p.x>W||p.y<0||p.y>H||p.life>p.max) { pts[idx]=spawn(); return; }
        const f = p.life<30?p.life/30:p.life>p.max-30?(p.max-p.life)/30:1;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fillStyle = p.col.replace(/[\d.]+\)$/,`${p.a*f})`); ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    resize(); init(); draw();
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}/>;
}

/* ═══ SHARED PRIMITIVES ══════════════════════════════════════════════════════ */
const ff = {
  d: "var(--font-display, 'Syne', sans-serif)",
  s: "var(--font-sans, 'DM Sans', sans-serif)",
  m: "var(--font-mono, 'JetBrains Mono', monospace)",
};

function Tag({ label, accent=C.accent }) {
  return (
    <div style={{display:"inline-flex",alignItems:"center",gap:8,marginBottom:10}}>
      <div style={{width:16,height:2,background:accent,borderRadius:1}}/>
      <span style={{fontFamily:ff.m,fontSize:10,fontWeight:600,color:accent,
        letterSpacing:".22em",textTransform:"uppercase"}}>
        {label}
      </span>
    </div>
  );
}

function H2({ children }) {
  return (
    <h2 style={{fontFamily:ff.d,fontSize:"clamp(24px,3.8vw,44px)",fontWeight:800,
      color:C.textPri,letterSpacing:"-.03em",margin:"4px 0 0"}}>
      {children}
    </h2>
  );
}

function DotGrid({ id="dg", color=C.accent, opacity=0.055 }) {
  return (
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity,pointerEvents:"none"}}>
      <defs><pattern id={id} width="24" height="24" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1.2" fill={color}/>
      </pattern></defs>
      <rect width="100%" height="100%" fill={`url(#${id})`}/>
    </svg>
  );
}

function Avatar({ initials, size=72, accent=C.accent, pulse=false, float=false }) {
  return (
    <div className={[pulse?"lp-pulse":"",float?"lp-float":""].filter(Boolean).join(" ")}
      style={{
        width:size, height:size, borderRadius:"50%", flexShrink:0,
        background:`radial-gradient(circle at 36% 36%, #252d52, ${C.cardDeep})`,
        border:`2.5px solid ${accent}`,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontFamily:ff.d, fontWeight:800, fontSize:size*.29, color:accent,
        letterSpacing:".04em", boxShadow:`0 0 0 4px ${accent}22`,
      }}>
      {initials}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. HERO
═══════════════════════════════════════════════════════════════════════════ */
function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target:ref, offset:["start start","end start"] });
  const y    = useTransform(scrollYProgress, [0,1], [0,100]);
  const opac = useTransform(scrollYProgress, [0,.65], [1,0]);

  return (
    <section ref={ref} style={{
      position:"relative", minHeight:"100vh",
      background:`radial-gradient(ellipse 80% 55% at 50% 0%,rgba(99,102,241,.17) 0%,${C.bg} 65%)`,
      display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden",
    }}>
      <ParticleCanvas/>
      {/* subtle grid */}
      <div style={{position:"absolute",inset:0,pointerEvents:"none",
        backgroundImage:`linear-gradient(rgba(99,102,241,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,.03) 1px,transparent 1px)`,
        backgroundSize:"64px 64px"}}/>

      <M.div style={{y, opacity:opac, position:"relative", zIndex:2, textAlign:"center", padding:"0 24px", maxWidth:860}}>
        {/* pill badge */}
        <M.div initial={{opacity:0,scale:.82}} animate={{opacity:1,scale:1}}
          transition={{duration:.55,ease:[.22,1,.36,1]}}
          style={{display:"flex",justifyContent:"center",marginBottom:36}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:10,
            background:C.accentGl,border:`1px solid ${C.accent}44`,
            borderRadius:40,padding:"8px 20px"}}>
            <div className="lp-shimmer" style={{width:6,height:6,borderRadius:"50%",
              background:C.accent,boxShadow:`0 0 8px ${C.accent}`}}/>
            <span style={{fontFamily:ff.m,fontSize:10,color:C.accentLt,letterSpacing:".22em",textTransform:"uppercase"}}>
              Meet the People Behind SCAFIS
            </span>
          </div>
        </M.div>

        {/* headline */}
        <M.h1 initial={{opacity:0,y:40}} animate={{opacity:1,y:0}}
          transition={{duration:.8,delay:.12,ease:[.22,1,.36,1]}}
          style={{fontFamily:ff.d,fontSize:"clamp(44px,7.5vw,94px)",
            fontWeight:800,color:C.textPri,lineHeight:1,letterSpacing:"-.03em",margin:"0 0 22px"}}>
          Our{" "}
          <span style={{background:`linear-gradient(135deg,${C.accent},${C.violet},${C.accentLt})`,
            WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
            Leadership
          </span>
        </M.h1>

        <M.p initial={{opacity:0,y:22}} animate={{opacity:1,y:0}}
          transition={{duration:.7,delay:.28,ease:[.22,1,.36,1]}}
          style={{fontFamily:ff.s,fontSize:"clamp(14px,1.9vw,18px)",color:C.textSec,
            lineHeight:1.78,maxWidth:540,margin:"0 auto 52px",fontWeight:300}}>
          Visionaries, scholars, and builders united by a single purpose — to democratise enterprise-grade financial intelligence.
        </M.p>

        {/* scroll mouse indicator */}
        <M.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:.9}}
          style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
          <M.div animate={{y:[0,9,0]}} transition={{duration:2,repeat:Infinity,ease:"easeInOut"}}
            style={{width:34,height:54,border:`1.5px solid ${C.border}`,borderRadius:17,
              display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"8px 0"}}>
            <M.div animate={{y:[0,18,0],opacity:[1,0,1]}}
              transition={{duration:2,repeat:Infinity,ease:"easeInOut"}}
              style={{width:4,height:8,borderRadius:2,background:C.accentLt}}/>
          </M.div>
          <span style={{fontFamily:ff.m,fontSize:9,color:C.textDim,letterSpacing:".18em",textTransform:"uppercase"}}>Scroll</span>
        </M.div>
      </M.div>

      <div style={{position:"absolute",bottom:0,left:0,right:0,height:130,
        background:`linear-gradient(transparent,${C.bg})`,pointerEvents:"none"}}/>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. LEADERSHIP HIERARCHY  — Team only (Founder & CEO removed)
═══════════════════════════════════════════════════════════════════════════ */
const TEAM_MEMBERS = [
  { initials:"FA", name:"Farhan",      title:"Legal Advisor", accent:C.green,
    desc:"Handles legal framework, contracts, and corporate compliance for the SCAFIS platform." },
  { initials:"HT", name:"Team Member", title:"Role TBA",      accent:C.green, desc:"Coming soon." },
  { initials:"SM", name:"Team Member", title:"Role TBA",      accent:C.green, desc:"Coming soon." },
];

function HierCard({ m }) {
  const [hov,setHov] = useState(false);
  return (
    <M.div variants={vUp}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        flex:"1 1 240px", maxWidth:380,
        background: hov ? `linear-gradient(145deg,#161b34,${C.cardDeep})` : C.card,
        border:`1px solid ${hov?m.accent+"55":C.border}`,
        borderRadius:16, padding:"22px 20px",
        display:"flex", gap:16, alignItems:"flex-start",
        cursor:"default", transition:"all .28s cubic-bezier(.22,1,.36,1)",
        boxShadow: hov ? `0 16px 48px ${m.accent}18` : "none",
        position:"relative", overflow:"hidden",
      }}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,transition:"all .28s",
        background:hov?`linear-gradient(90deg,${m.accent},transparent)`:"transparent"}}/>
      <Avatar initials={m.initials} size={50} accent={m.accent}/>
      <div style={{flex:1,minWidth:0}}>
        <p style={{fontFamily:ff.d,fontSize:14,fontWeight:700,color:C.textPri,
          marginBottom:2,letterSpacing:"-.01em"}}>{m.name}</p>
        <p style={{fontFamily:ff.m,fontSize:9,color:m.accent,letterSpacing:".15em",
          textTransform:"uppercase",marginBottom:8,fontWeight:500}}>{m.title}</p>
        <p style={{fontFamily:ff.s,fontSize:12,color:C.textSec,lineHeight:1.7,margin:0}}>{m.desc}</p>
      </div>
    </M.div>
  );
}

function LeadershipHierarchy() {
  return (
    <section style={{background:C.bg,padding:"96px 24px 56px"}}>
      <div style={{maxWidth:1080,margin:"0 auto"}}>
        <FV>
          <Tag label="Organisation"/>
          <H2>Leadership Hierarchy</H2>
          <p style={{fontFamily:ff.s,fontSize:14,color:C.textSec,
            margin:"10px 0 56px",maxWidth:460,lineHeight:1.72}}>
            The structure that powers SCAFIS — from visionary founders to technical builders.
          </p>
        </FV>

        {/* Team row only */}
        <M.div initial="hidden" whileInView="show"
          viewport={{once:true,amount:.05}} variants={vStagger}>
          <M.div variants={vUp}
            style={{display:"flex",flexWrap:"wrap",gap:0,
              borderBottom:`1px solid ${C.border}`,paddingBottom:44}}>
            {/* left label */}
            <div style={{flex:"0 0 170px",minWidth:130,paddingRight:28,paddingTop:4}}>
              <div style={{display:"inline-flex",alignItems:"center",gap:6,
                background:`${C.green}14`,border:`1px solid ${C.green}33`,
                borderRadius:6,padding:"4px 10px",marginBottom:12}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:C.green}}/>
                <span style={{fontFamily:ff.m,fontSize:9,color:C.green,
                  letterSpacing:".2em",textTransform:"uppercase"}}>Team</span>
              </div>
              <div style={{width:1,height:28,background:`linear-gradient(${C.green},transparent)`,marginLeft:2}}/>
            </div>
            {/* cards */}
            <div style={{flex:1,minWidth:280,display:"flex",flexWrap:"wrap",gap:14}}>
              {TEAM_MEMBERS.map(m => <HierCard key={m.initials} m={m}/>)}
            </div>
          </M.div>
        </M.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SPOTLIGHT PANEL — reusable (Founder + CEO)
═══════════════════════════════════════════════════════════════════════════ */
function SpotlightPanel({ person, missionLabel, missions, quote, stats, accent=C.accent }) {
  return (
    <div style={{
      display:"flex",flexWrap:"wrap",borderRadius:20,overflow:"hidden",
      border:`1px solid ${C.border}`,
      boxShadow:`0 32px 80px rgba(0,0,0,.55), 0 0 0 1px ${accent}15`,
    }}>
      {/* LEFT portrait */}
      <div style={{
        flex:"0 0 300px",minWidth:220,
        background:`radial-gradient(ellipse at 50% 0%, ${accent}20 0%, #0b0e1a 100%)`,
        display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
        padding:"52px 28px",gap:22,
        position:"relative",overflow:"hidden",
        borderRight:`1px solid ${C.border}`,
      }}>
        <DotGrid id={`sg-${person.initials}`} color={accent}/>
        {/* glow orb */}
        <div style={{position:"absolute",top:"12%",left:"50%",transform:"translateX(-50%)",
          width:190,height:190,borderRadius:"50%",
          background:`${accent}1e`,filter:"blur(44px)",pointerEvents:"none"}}/>

        <div className="lp-float">
          <Avatar initials={person.initials} size={120} accent={accent} pulse/>
        </div>

        <div style={{textAlign:"center",position:"relative"}}>
          <p style={{fontFamily:ff.d,fontSize:19,fontWeight:800,color:C.textPri,
            letterSpacing:"-.01em",marginBottom:8}}>{person.name}</p>
          <div style={{display:"inline-flex",
            background:`${accent}18`,border:`1px solid ${accent}44`,
            borderRadius:20,padding:"5px 14px"}}>
            <span style={{fontFamily:ff.m,fontSize:9,color:accent,
              letterSpacing:".18em",textTransform:"uppercase"}}>{person.title}</span>
          </div>
        </div>

        {stats && (
          <div style={{display:"flex",gap:22,marginTop:4}}>
            {stats.map(s => (
              <div key={s.lbl} style={{textAlign:"center"}}>
                <p style={{fontFamily:ff.d,fontSize:26,fontWeight:800,color:accent,
                  margin:0,letterSpacing:"-.02em"}}>{s.val}</p>
                <p style={{fontFamily:ff.m,fontSize:8.5,color:C.textDim,
                  letterSpacing:".15em",textTransform:"uppercase",margin:0}}>{s.lbl}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT vision */}
      <div style={{flex:1,minWidth:280,background:C.card,padding:"48px 44px"}}>
        <p style={{fontFamily:ff.m,fontSize:9.5,color:C.accentLt,
          letterSpacing:".22em",textTransform:"uppercase",marginBottom:28}}>
          {missionLabel}
        </p>

        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {missions.map((item,i) => (
            <M.div key={i}
              initial={{opacity:0,x:18}} whileInView={{opacity:1,x:0}}
              viewport={{once:true}}
              transition={{delay:i*.1,duration:.52,ease:[.22,1,.36,1]}}
              whileHover={{borderColor:`${accent}55`}}
              style={{display:"flex",gap:16,alignItems:"flex-start",
                padding:"15px 18px",background:C.accentG2,
                border:`1px solid ${C.borderLo}`,borderRadius:12,
                cursor:"default",transition:"border-color .2s"}}>
              {/* number badge */}
              <div style={{width:26,height:26,borderRadius:8,flexShrink:0,
                background:C.accentGl,border:`1px solid ${accent}44`,
                display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontFamily:ff.m,fontSize:10,fontWeight:700,color:C.accentLt}}>{i+1}</span>
              </div>
              <p style={{fontFamily:ff.s,fontSize:13.5,color:C.textSec,lineHeight:1.76,margin:0}}>{item}</p>
            </M.div>
          ))}
        </div>

        {quote && (
          <div style={{marginTop:28,borderLeft:`2.5px solid ${accent}`,paddingLeft:18}}>
            <p style={{fontFamily:ff.s,fontSize:13,color:C.textDim,fontStyle:"italic",
              lineHeight:1.72,margin:0}}>"{quote}"</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. FOUNDER SPOTLIGHT
═══════════════════════════════════════════════════════════════════════════ */
function FounderSpotlight() {
  return (
    <section style={{background:C.bg,padding:"0 24px 80px",borderTop:`1px solid ${C.border}`}}>
      <div style={{maxWidth:1080,margin:"0 auto",paddingTop:88}}>
        <FV><Tag label="Founder"/><H2>Founder Spotlight</H2></FV>
        <div style={{height:36}}/>
        <FV>
          <SpotlightPanel
            accent={C.accent}
            person={{initials:"RZ",name:"Rana Muhammad Zain ul Abideen",title:"Chairman & Founder"}}
            missionLabel="Founder's Mission for SCAFIS"
            stats={[{val:"12+",lbl:"Years"},{val:"4",lbl:"ERP Systems"},{val:"50+",lbl:"Companies"}]}
            missions={[
              "Built SCAFIS as a comprehensive ERP solution from the ground up — architecting it as a precision decision-making engine for modern organisations.",
              "Specialises in financial reporting systems, AI-powered matching logic, and autonomous accounting solutions at enterprise scale.",
              "Democratising enterprise-grade financial intelligence for businesses of every size — from SMEs to large corporations.",
            ]}
            quote="SCAFIS is not just software — it's a financial intelligence platform that evolves with your business."
          />
        </FV>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. ADVISORS
═══════════════════════════════════════════════════════════════════════════ */
const ADVISORS = [
  {
    initials:"MS", name:"Prof. Mohammad Saad Anwar", title:"Taxation Lawyer",
    accent:"#22d3ee", glow:"rgba(34,211,238,0.13)",
    expertise:["Tax Law","Analytics","Regulatory"],
    desc:"Certified trainer and analytical innovation expert providing strategic oversight on SCAFIS's data pipelines and financial intelligence frameworks. Brings deep expertise in tax legislation and corporate advisory.",
    impact:[{val:"15+",lbl:"Years"},{val:"200+",lbl:"Cases"}],
  },
  {
    initials:"MR", name:"Prof. Muhammed Rehan Anjum", title:"Accounting Specialist",
    accent:"#f59e0b", glow:"rgba(245,158,11,0.13)",
    expertise:["IFRS","Compliance","Data Integrity"],
    desc:"Leads advisory on accounting standards and regulatory compliance, ensuring audit-grade accuracy across all SCAFIS modules. Authority on IFRS implementation and enterprise data governance.",
    impact:[{val:"18+",lbl:"Years"},{val:"300+",lbl:"Audits"}],
  },
];

function AdvisorCard({ adv, idx }) {
  const [hov,setHov] = useState(false);
  return (
    <M.div initial="hidden" whileInView="show" viewport={{once:true,amount:.08}}
      variants={idx===0?vLeft:vRight}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        flex:"1 1 320px",minWidth:300,
        background:hov?`linear-gradient(145deg,#131828,${C.cardDeep})`:C.card,
        border:`1px solid ${hov?adv.accent+"55":C.border}`,
        borderRadius:20,overflow:"hidden",cursor:"default",
        transition:"all .32s cubic-bezier(.22,1,.36,1)",
        boxShadow:hov?`0 22px 60px ${adv.accent}20, 0 0 0 1px ${adv.accent}16`:"none",
      }}>

      {/* top bar */}
      <div style={{height:3,transition:"all .32s",
        background:hov
          ?`linear-gradient(90deg,${adv.accent},${adv.accent}77,transparent)`
          :`linear-gradient(90deg,${adv.accent}44,transparent)`}}/>

      {/* header */}
      <div style={{display:"flex",gap:20,alignItems:"flex-start",padding:"28px 28px 0",position:"relative"}}>
        {/* bg glow */}
        <div style={{position:"absolute",top:-24,right:-24,width:150,height:150,
          borderRadius:"50%",background:hov?adv.glow:"transparent",
          filter:"blur(34px)",transition:"all .4s",pointerEvents:"none"}}/>

        <div style={{position:"relative"}}>
          <Avatar initials={adv.initials} size={80} accent={adv.accent}/>
          {/* status dot */}
          <div style={{position:"absolute",bottom:2,right:2,width:14,height:14,
            borderRadius:"50%",background:adv.accent,
            border:`2px solid ${C.card}`,boxShadow:`0 0 8px ${adv.accent}`}}/>
        </div>

        <div style={{flex:1,paddingTop:4}}>
          <p style={{fontFamily:ff.d,fontSize:16,fontWeight:800,color:C.textPri,
            letterSpacing:"-.01em",marginBottom:6}}>{adv.name}</p>
          <div style={{display:"inline-flex",background:`${adv.accent}18`,
            border:`1px solid ${adv.accent}44`,borderRadius:16,
            padding:"3px 12px",marginBottom:12}}>
            <span style={{fontFamily:ff.m,fontSize:9,color:adv.accent,
              letterSpacing:".16em",textTransform:"uppercase"}}>{adv.title}</span>
          </div>
          {/* expertise pills */}
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {adv.expertise.map(t => (
              <span key={t} style={{fontFamily:ff.m,fontSize:8.5,color:C.textDim,
                background:C.accentG3,border:`1px solid ${C.border}`,
                borderRadius:8,padding:"2px 9px",letterSpacing:".1em",textTransform:"uppercase"}}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* divider */}
      <div style={{height:1,margin:"20px 28px",
        background:`linear-gradient(90deg,transparent,${C.border},transparent)`}}/>

      {/* body */}
      <div style={{padding:"0 28px"}}>
        <p style={{fontFamily:ff.s,fontSize:13,color:C.textSec,lineHeight:1.78,margin:0}}>{adv.desc}</p>
      </div>

      {/* footer stats */}
      <div style={{display:"flex",marginTop:24,borderTop:`1px solid ${C.border}`}}>
        {adv.impact.map((s,i) => (
          <div key={s.lbl} style={{flex:1,textAlign:"center",padding:"16px 12px",
            borderRight:i<adv.impact.length-1?`1px solid ${C.border}`:"none"}}>
            <p style={{fontFamily:ff.d,fontSize:22,fontWeight:800,margin:0,
              color:hov?adv.accent:C.textPri,transition:"color .25s"}}>{s.val}</p>
            <p style={{fontFamily:ff.m,fontSize:8.5,color:C.textDim,
              letterSpacing:".15em",textTransform:"uppercase",margin:0}}>{s.lbl}</p>
          </div>
        ))}
        <div style={{flex:2,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
          <span style={{fontFamily:ff.m,fontSize:8.5,color:C.textDim,
            letterSpacing:".12em",textTransform:"uppercase",textAlign:"center",lineHeight:1.6}}>
            Academic Advisor<br/>SCAFIS Advisory Board
          </span>
        </div>
      </div>
    </M.div>
  );
}

function AdvisorsSection() {
  return (
    <section style={{background:C.bg,padding:"88px 24px",borderTop:`1px solid ${C.border}`}}>
      <div style={{maxWidth:1080,margin:"0 auto"}}>
        <FV>
          <Tag label="Advisory Board"/>
          <H2>Mentors &amp; Academic Advisors</H2>
          <p style={{fontFamily:ff.s,fontSize:14,color:C.textSec,
            margin:"10px 0 48px",maxWidth:500,lineHeight:1.75}}>
            Distinguished academics and industry leaders who shape SCAFIS's intellectual and strategic foundation.
          </p>
        </FV>

        <div style={{display:"flex",flexWrap:"wrap",gap:20}}>
          {ADVISORS.map((adv,i) => <AdvisorCard key={adv.initials} adv={adv} idx={i}/>)}
        </div>

        <FV style={{marginTop:24,textAlign:"center"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:14}}>
            <div style={{width:36,height:1,background:C.border}}/>
            <span style={{fontFamily:ff.m,fontSize:8.5,color:C.textDim,
              letterSpacing:".2em",textTransform:"uppercase"}}>
              Connection to Centre Links
            </span>
            <div style={{width:36,height:1,background:C.border}}/>
          </div>
        </FV>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. CEO SPOTLIGHT
═══════════════════════════════════════════════════════════════════════════ */
function CEOSpotlight() {
  return (
    <section style={{background:C.bg,padding:"0 24px 88px",borderTop:`1px solid ${C.border}`}}>
      <div style={{maxWidth:1080,margin:"0 auto",paddingTop:88}}>
        <FV><Tag label="Executive" accent={C.violet}/><H2>CEO Spotlight</H2></FV>
        <div style={{height:36}}/>
        <FV>
          <SpotlightPanel
            accent={C.violet}
            person={{initials:"AK",name:"Ayesha Kashif",title:"CEO & Co-Founder"}}
            missionLabel="Strategic Operational Vision"
            stats={[{val:"3+",lbl:"Years"},{val:"50+",lbl:"Clients"}]}
            missions={[
              "SaaS growth strategy — scaling outreach and accelerating enterprise business development.",
              "User experience priorities — championing product accessibility and design-first standards.",
              "Market adoption goals — driving client acquisition and sector-specific GTM strategies.",
            ]}
            quote="Building SCAFIS into a platform every finance professional can rely on — from SMEs to enterprise."
          />
        </FV>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. TEAM SECTION  (separate standalone cards)
═══════════════════════════════════════════════════════════════════════════ */
function TeamCard({ m, idx }) {
  const [hov,setHov] = useState(false);
  return (
    <M.div initial="hidden" whileInView="show"
      viewport={{once:true,amount:.08}} variants={vUp}
      transition={{delay:idx*.1}}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        flex:"1 1 220px", maxWidth:340,
        background:hov?`linear-gradient(145deg,#161b34,${C.cardDeep})`:C.card,
        border:`1px solid ${hov?C.green+"55":C.border}`,
        borderRadius:16, padding:"24px 22px",
        display:"flex", gap:16, alignItems:"flex-start",
        cursor:"default", transition:"all .28s cubic-bezier(.22,1,.36,1)",
        boxShadow:hov?`0 16px 48px ${C.green}18`:"none",
        position:"relative", overflow:"hidden",
      }}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,transition:"all .28s",
        background:hov?`linear-gradient(90deg,${C.green},transparent)`:"transparent"}}/>
      <Avatar initials={m.initials} size={52} accent={C.green}/>
      <div style={{flex:1,minWidth:0}}>
        <p style={{fontFamily:ff.d,fontSize:14.5,fontWeight:700,color:C.textPri,
          marginBottom:2,letterSpacing:"-.01em"}}>{m.name}</p>
        <p style={{fontFamily:ff.m,fontSize:9,color:C.green,letterSpacing:".15em",
          textTransform:"uppercase",marginBottom:8,fontWeight:500}}>{m.title}</p>
        <p style={{fontFamily:ff.s,fontSize:12,color:C.textSec,lineHeight:1.7,margin:0}}>{m.desc}</p>
      </div>
    </M.div>
  );
}

function TeamSection() {
  return (
    <section style={{background:C.bg,padding:"88px 24px",borderTop:`1px solid ${C.border}`}}>
      <div style={{maxWidth:1080,margin:"0 auto"}}>
        <FV>
          <Tag label="Team" accent={C.green}/>
          <H2>Our Team</H2>
          <p style={{fontFamily:ff.s,fontSize:14,color:C.textSec,
            margin:"10px 0 48px",maxWidth:440,lineHeight:1.72}}>
            The talented individuals who build and maintain SCAFIS day by day.
          </p>
        </FV>
        <div style={{display:"flex",flexWrap:"wrap",gap:16}}>
          {TEAM_MEMBERS.map((m,i) => <TeamCard key={m.initials} m={m} idx={i}/>)}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. TEAM MARQUEE
═══════════════════════════════════════════════════════════════════════════ */
const MQ_DATA = [
  {initials:"RZ",name:"Rana Zain",     role:"Chairman",    dept:"Founder",  accent:C.accent},
  {initials:"AK",name:"Ayesha Kashif", role:"CEO",         dept:"Executive",accent:C.violet},
  {initials:"MS",name:"Prof. Saad",    role:"Tax Advisor", dept:"Advisory", accent:C.cyan},
  {initials:"MR",name:"Prof. Rehan",   role:"Compliance",  dept:"Advisory", accent:C.amber},
  {initials:"FA",name:"Farhan",        role:"Legal",       dept:"Team",     accent:C.green},
  {initials:"HT",name:"Team Member",   role:"Engineering", dept:"Team",     accent:C.green},
  {initials:"SM",name:"Team Member",   role:"Engineering", dept:"Team",     accent:C.green},
  {initials:"UA",name:"Team Member",   role:"QA",          dept:"Team",     accent:C.green},
  {initials:"FN",name:"Team Member",   role:"Finance",     dept:"Finance",  accent:C.amber},
  {initials:"ZK",name:"Team Member",   role:"Accounts",    dept:"Finance",  accent:C.amber},
];

function MqCard({ p }) {
  const [hov,setHov] = useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        flexShrink:0, width:174,
        display:"flex", flexDirection:"column", alignItems:"center", gap:12,
        padding:"22px 16px",
        background:hov?`linear-gradient(160deg,#161b34,${C.cardDeep})`:C.card,
        border:`1px solid ${hov?p.accent+"55":C.border}`,
        borderRadius:16, margin:"0 8px",
        cursor:"default", transition:"all .25s cubic-bezier(.22,1,.36,1)",
        transform:hov?"scale(1.06)":"scale(1)",
        boxShadow:hov?`0 16px 40px ${p.accent}22`:"none",
      }}>
      <div style={{width:64,height:64,borderRadius:"50%",
        background:`radial-gradient(circle at 36% 36%,#252d52,${C.cardDeep})`,
        border:`2px solid ${hov?p.accent:C.border}`,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontFamily:ff.d,fontWeight:800,fontSize:16,
        color:hov?p.accent:C.textSec,transition:"all .25s",
        boxShadow:hov?`0 0 0 4px ${p.accent}22`:"none"}}>
        {p.initials}
      </div>
      <div style={{textAlign:"center"}}>
        <p style={{fontFamily:ff.s,fontSize:12.5,fontWeight:600,
          color:hov?C.textPri:C.textSec,margin:"0 0 3px",transition:"color .2s"}}>{p.name}</p>
        <p style={{fontFamily:ff.m,fontSize:9,color:hov?p.accent:C.textDim,
          letterSpacing:".1em",textTransform:"uppercase",margin:0,transition:"color .2s"}}>{p.role}</p>
      </div>
      <div style={{background:`${p.accent}18`,border:`1px solid ${p.accent}30`,
        borderRadius:10,padding:"2px 10px",
        fontFamily:ff.m,fontSize:8,color:p.accent,letterSpacing:".12em",textTransform:"uppercase"}}>
        {p.dept}
      </div>
    </div>
  );
}

function TeamMarquee() {
  const doubled = [...MQ_DATA,...MQ_DATA];
  return (
    <section style={{background:C.cardDeep,padding:"80px 0",borderTop:`1px solid ${C.border}`,overflow:"hidden"}}>
      <div style={{maxWidth:1080,margin:"0 auto",padding:"0 24px",marginBottom:44}}>
        <FV>
          <Tag label="Full Roster"/>
          <H2>Everyone Building SCAFIS</H2>
          <p style={{fontFamily:ff.s,fontSize:14,color:C.textSec,
            lineHeight:1.7,maxWidth:380,margin:"8px 0 0"}}>
            Hover to pause · Each card lights up on hover
          </p>
        </FV>
      </div>
      <div style={{position:"relative"}}>
        {/* fade masks */}
        <div style={{position:"absolute",left:0,top:0,bottom:0,width:100,zIndex:2,
          background:`linear-gradient(90deg,${C.cardDeep},transparent)`,pointerEvents:"none"}}/>
        <div style={{position:"absolute",right:0,top:0,bottom:0,width:100,zIndex:2,
          background:`linear-gradient(-90deg,${C.cardDeep},transparent)`,pointerEvents:"none"}}/>
        <div className="lp-mq-track" style={{display:"flex",alignItems:"stretch",width:"max-content"}}>
          {doubled.map((p,i) => <MqCard key={i} p={p}/>)}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ROOT EXPORT
═══════════════════════════════════════════════════════════════════════════ */
export default function LeadershipPage() {
  return (
    <M.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      transition={{duration:.42}}
      style={{background:C.bg,minHeight:"100vh"}}>
      <Navbar/>
      {/* ORDER: Hero → Hierarchy → Founder → Advisors → CEO → Team → Marquee */}
      <Hero/>
      <LeadershipHierarchy/>
      <FounderSpotlight/>
      <AdvisorsSection/>
      <CEOSpotlight/>
      <TeamSection/>
      <TeamMarquee/>
      <Footer/>
    </M.div>
  );
}
