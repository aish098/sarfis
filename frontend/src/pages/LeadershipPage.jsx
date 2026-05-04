/**
 * LeadershipPage.jsx  —  SCAFIS Premium Leadership (Final)
 *
 * Changes from previous version:
 *  ✅ Founder Spotlight — matches CEO Spotlight layout (split panel, stats, mission points)
 *  ✅ Advisors — redesigned as large premium cards with glow, stats, decorative elements
 *  ✅ Uses project font variables (font-display / font-sans from Tailwind config)
 *  ✅ Strictly follows color system: #1a1f2e / #12162a / #2a3044 / #6366f1
 *  ✅ All positions maintained (Hero → Hierarchy → Founder → CEO → Advisors → Team)
 */

import { useEffect, useRef, useState } from "react";
import { motion as M, useScroll, useTransform, AnimatePresence } from "framer-motion";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

/* ─── tokens ───────────────────────────────────────────────────────────────── */
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
  green:    "#34d399",
  amber:    "#f59e0b",
  textPri:  "#f1f5f9",
  textSec:  "#94a3b8",
  textDim:  "#475569",
};

/* ─── keyframes (injected once) ─────────────────────────────────────────────── */
if (typeof document !== "undefined" && !document.getElementById("lp-styles")) {
  const s = document.createElement("style");
  s.id = "lp-styles";
  s.textContent = `
    @keyframes marquee    { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
    @keyframes float-slow { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-10px) rotate(.8deg)} }
    @keyframes pulse-ring { 0%{box-shadow:0 0 0 0 rgba(99,102,241,.4)} 70%{box-shadow:0 0 0 16px rgba(99,102,241,0)} 100%{box-shadow:0 0 0 0 rgba(99,102,241,0)} }
    @keyframes shimmer    { 0%,100%{opacity:.5} 50%{opacity:1} }
    .mq-track            { animation: marquee 36s linear infinite; }
    .mq-track:hover      { animation-play-state: paused; }
    .float-el            { animation: float-slow 6s ease-in-out infinite; }
    .pulse-el            { animation: pulse-ring 2.6s ease-out infinite; }
    .shimmer-el          { animation: shimmer 3s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
}

/* ─── motion variants ───────────────────────────────────────────────────────── */
const up      = { hidden:{opacity:0,y:32}, show:{opacity:1,y:0,transition:{duration:.65,ease:[.22,1,.36,1]}} };
const left    = { hidden:{opacity:0,x:-32}, show:{opacity:1,x:0,transition:{duration:.6,ease:[.22,1,.36,1]}} };
const right_v = { hidden:{opacity:0,x:32},  show:{opacity:1,x:0,transition:{duration:.6,ease:[.22,1,.36,1]}} };
const stagger = { show:{transition:{staggerChildren:.09}} };

function FV({ children, v=up, delay=0, style={}, className="" }) {
  return (
    <M.div initial="hidden" whileInView="show" viewport={{once:true,amount:.1}}
      variants={v} transition={{delay}} style={style} className={className}>
      {children}
    </M.div>
  );
}

/* ─── particle canvas ───────────────────────────────────────────────────────── */
function ParticleCanvas() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d");
    let raf, W, H, pts = [];
    const COL = ["rgba(99,102,241,.55)","rgba(129,140,248,.45)","rgba(167,139,250,.35)","rgba(34,211,238,.25)"];
    const resize = () => { W=c.width=c.offsetWidth; H=c.height=c.offsetHeight; };
    const spawn  = () => ({
      x:Math.random()*W, y:Math.random()*H,
      r:Math.random()*1.6+.3,
      vx:(Math.random()-.5)*.2, vy:(Math.random()-.5)*.2,
      col:COL[Math.floor(Math.random()*COL.length)],
      a:Math.random()*.7+.2, life:0,
      max:180+Math.random()*240,
    });
    const init = () => { pts = Array.from({length:80},spawn); };
    const draw = () => {
      ctx.clearRect(0,0,W,H);
      for (let i=0;i<pts.length;i++) for (let j=i+1;j<pts.length;j++) {
        const dx=pts[i].x-pts[j].x, dy=pts[i].y-pts[j].y, d=Math.hypot(dx,dy);
        if (d<110) { ctx.beginPath(); ctx.strokeStyle=`rgba(99,102,241,${.07*(1-d/110)})`; ctx.lineWidth=.4; ctx.moveTo(pts[i].x,pts[i].y); ctx.lineTo(pts[j].x,pts[j].y); ctx.stroke(); }
      }
      pts.forEach((p,idx)=>{
        p.x+=p.vx; p.y+=p.vy; p.life++;
        if (p.x<0||p.x>W||p.y<0||p.y>H||p.life>p.max) { pts[idx]=spawn(); return; }
        const f2=p.life<30?p.life/30:p.life>p.max-30?(p.max-p.life)/30:1;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fillStyle=p.col.replace(/[\d.]+\)$/,`${p.a*f2})`); ctx.fill();
      });
      raf=requestAnimationFrame(draw);
    };
    resize(); init(); draw();
    window.addEventListener("resize",resize);
    return ()=>{ cancelAnimationFrame(raf); window.removeEventListener("resize",resize); };
  },[]);
  return <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}/>;
}

/* ─── shared primitives ─────────────────────────────────────────────────────── */
function Tag({ label }) {
  return (
    <div style={{display:"inline-flex",alignItems:"center",gap:8,marginBottom:10}}>
      <div style={{width:18,height:2,background:C.accent,borderRadius:1}}/>
      <span style={{fontFamily:"var(--font-display,'Syne',sans-serif)",fontSize:10,fontWeight:600,
        color:C.accentLt,letterSpacing:"0.22em",textTransform:"uppercase"}}>
        {label}
      </span>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 style={{fontFamily:"var(--font-display,'Syne',sans-serif)",
      fontSize:"clamp(26px,4vw,46px)",fontWeight:800,color:C.textPri,
      letterSpacing:"-0.03em",margin:"4px 0 0"}}>
      {children}
    </h2>
  );
}

/* Dot-grid SVG texture */
function DotGrid({ color=C.accent, id="dg", opacity=0.06 }) {
  return (
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity,pointerEvents:"none"}}>
      <defs><pattern id={id} width="24" height="24" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1.2" fill={color}/>
      </pattern></defs>
      <rect width="100%" height="100%" fill={`url(#${id})`}/>
    </svg>
  );
}

/* Avatar circle */
function Avatar({ initials, size=72, accent=C.accent, pulse=false, float=false }) {
  return (
    <div className={[pulse?"pulse-el":"",float?"float-el":""].join(" ")} style={{
      width:size,height:size,borderRadius:"50%",flexShrink:0,
      background:`radial-gradient(circle at 36% 36%, #252d52, ${C.cardDeep})`,
      border:`2.5px solid ${accent}`,
      display:"flex",alignItems:"center",justifyContent:"center",
      fontFamily:"var(--font-display,'Syne',sans-serif)",fontWeight:800,
      fontSize:size*.3,color:accent,letterSpacing:".04em",
      boxShadow:`0 0 0 4px ${accent}22`,
    }}>
      {initials}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HERO
═══════════════════════════════════════════════════════════════════════════ */
function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({target:ref,offset:["start start","end start"]});
  const y    = useTransform(scrollYProgress,[0,1],[0,110]);
  const opac = useTransform(scrollYProgress,[0,.7],[1,0]);

  return (
    <section ref={ref} style={{
      position:"relative",minHeight:"100vh",
      background:`radial-gradient(ellipse 80% 55% at 50% 0%,rgba(99,102,241,.18) 0%,${C.bg} 65%)`,
      display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",
    }}>
      <ParticleCanvas/>
      {/* grid */}
      <div style={{position:"absolute",inset:0,pointerEvents:"none",
        backgroundImage:`linear-gradient(rgba(99,102,241,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,.035) 1px,transparent 1px)`,
        backgroundSize:"64px 64px"}}/>

      <M.div style={{y,opacity:opac,position:"relative",zIndex:2,textAlign:"center",padding:"0 24px",maxWidth:860}}>
        {/* badge */}
        <M.div initial={{opacity:0,scale:.85}} animate={{opacity:1,scale:1}}
          transition={{duration:.55,ease:[.22,1,.36,1]}}
          style={{display:"flex",justifyContent:"center",marginBottom:36}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:10,
            background:C.accentGl,border:`1px solid ${C.accent}44`,
            borderRadius:40,padding:"8px 20px"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:C.accent,boxShadow:`0 0 8px ${C.accent}`}} className="shimmer-el"/>
            <span style={{fontFamily:"var(--font-mono,'JetBrains Mono',monospace)",fontSize:10,
              color:C.accentLt,letterSpacing:".22em",textTransform:"uppercase"}}>
              Meet the People Behind SCAFIS
            </span>
          </div>
        </M.div>

        {/* heading */}
        <M.h1 initial={{opacity:0,y:40}} animate={{opacity:1,y:0}}
          transition={{duration:.8,delay:.15,ease:[.22,1,.36,1]}}
          style={{fontFamily:"var(--font-display,'Syne',sans-serif)",
            fontSize:"clamp(42px,7.5vw,92px)",fontWeight:800,color:C.textPri,
            lineHeight:1,letterSpacing:"-.03em",margin:"0 0 22px"}}>
          Our{" "}
          <span style={{background:`linear-gradient(135deg,${C.accent},${C.violet},${C.accentLt})`,
            WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>
            Leadership
          </span>
        </M.h1>

        <M.p initial={{opacity:0,y:24}} animate={{opacity:1,y:0}}
          transition={{duration:.7,delay:.3,ease:[.22,1,.36,1]}}
          style={{fontFamily:"var(--font-sans,'DM Sans',sans-serif)",
            fontSize:"clamp(15px,2vw,18px)",color:C.textSec,lineHeight:1.75,
            maxWidth:540,margin:"0 auto 52px",fontWeight:300}}>
          Visionaries, scholars, and builders united by a single purpose — to democratise enterprise-grade financial intelligence.
        </M.p>

        {/* scroll mouse */}
        <M.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:.85}}
          style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
          <M.div animate={{y:[0,9,0]}} transition={{duration:2,repeat:Infinity,ease:"easeInOut"}}
            style={{width:34,height:54,border:`1.5px solid ${C.border}`,borderRadius:17,
              display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"8px 0"}}>
            <M.div animate={{y:[0,18,0],opacity:[1,0,1]}}
              transition={{duration:2,repeat:Infinity,ease:"easeInOut"}}
              style={{width:4,height:8,borderRadius:2,background:C.accentLt}}/>
          </M.div>
          <span style={{fontFamily:"var(--font-mono)",fontSize:9,color:C.textDim,
            letterSpacing:".18em",textTransform:"uppercase"}}>Scroll</span>
        </M.div>
      </M.div>

      <div style={{position:"absolute",bottom:0,left:0,right:0,height:130,
        background:`linear-gradient(transparent,${C.bg})`,pointerEvents:"none"}}/>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HIERARCHY ROWS (Founder / Co-Founder / Team listed cards)
═══════════════════════════════════════════════════════════════════════════ */
const HIER_MEMBERS = [
  { initials:"RZ", name:"Rana Muhammad Zain ul Abideen", title:"Chairman & Founder", accent:"#6366f1",
    desc:"Chartered Accountant and enterprise ERP architect. Specialises in financial reporting systems, AI-powered matching logic, and autonomous accounting solutions." },
  { initials:"AK", name:"Ayesha Kashif", title:"CEO & Co-Founder", accent:"#a78bfa",
    desc:"Drives SCAFIS's SaaS growth strategy, product UX, and market adoption. Champions accessibility-first design and sector-specific go-to-market execution." },
  { initials:"FA", name:"Farhan", title:"Legal Advisor", accent:"#34d399",
    desc:"Handles legal framework, contracts, and corporate compliance for the SCAFIS platform." },
  { initials:"HT", name:"Team Member", title:"Role TBA", accent:"#34d399", desc:"Coming soon." },
  { initials:"SM", name:"Team Member", title:"Role TBA", accent:"#34d399", desc:"Coming soon." },
];

const CATEGORIES = [
  { label:"Founder",    keys:["RZ"] },
  { label:"Co-Founder", keys:["AK"] },
  { label:"Team",       keys:["FA","HT","SM"] },
];

function HierCard({ m }) {
  const [hov,setHov] = useState(false);
  return (
    <M.div variants={up} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{flex:"1 1 260px",maxWidth:420,
        background:hov?`linear-gradient(145deg,#161b34,${C.cardDeep})`:C.card,
        border:`1px solid ${hov?m.accent+"55":C.border}`,
        borderRadius:16,padding:"22px 20px",
        display:"flex",gap:16,alignItems:"flex-start",cursor:"default",
        transition:"all .28s cubic-bezier(.22,1,.36,1)",
        boxShadow:hov?`0 16px 48px ${m.accent}18`:"none",
        position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,transition:"all .28s",
        background:hov?`linear-gradient(90deg,${m.accent},transparent)`:"transparent"}}/>
      <Avatar initials={m.initials} size={50} accent={m.accent}/>
      <div style={{flex:1,minWidth:0}}>
        <p style={{fontFamily:"var(--font-display)",fontSize:14,fontWeight:700,
          color:C.textPri,marginBottom:2,letterSpacing:"-.01em"}}>{m.name}</p>
        <p style={{fontFamily:"var(--font-mono)",fontSize:9,color:m.accent,
          letterSpacing:".15em",textTransform:"uppercase",marginBottom:8,fontWeight:500}}>{m.title}</p>
        <p style={{fontFamily:"var(--font-sans)",fontSize:12,color:C.textSec,lineHeight:1.7,margin:0}}>{m.desc}</p>
      </div>
    </M.div>
  );
}

function LeadershipHierarchy() {
  return (
    <section style={{background:C.bg,padding:"96px 24px 48px"}}>
      <div style={{maxWidth:1080,margin:"0 auto"}}>
        <FV><Tag label="Organisation"/><SectionTitle>Leadership Hierarchy</SectionTitle>
          <p style={{fontFamily:"var(--font-sans)",fontSize:14,color:C.textSec,
            margin:"10px 0 56px",maxWidth:460,lineHeight:1.7}}>
            The structure that powers SCAFIS — from visionary founders to technical builders.
          </p>
        </FV>
        <M.div initial="hidden" whileInView="show" viewport={{once:true,amount:.05}} variants={stagger}>
          {CATEGORIES.map(cat => {
            const members = HIER_MEMBERS.filter(m => cat.keys.includes(m.initials));
            const accent  = members[0]?.accent || C.accent;
            return (
              <M.div key={cat.label} variants={up}
                style={{display:"flex",flexWrap:"wrap",gap:0,
                  borderBottom:`1px solid ${C.border}`,paddingBottom:44,marginBottom:44}}>
                {/* category col */}
                <div style={{flex:"0 0 170px",minWidth:130,paddingRight:28,paddingTop:4}}>
                  <div style={{display:"inline-flex",alignItems:"center",gap:6,
                    background:`${accent}14`,border:`1px solid ${accent}33`,
                    borderRadius:6,padding:"4px 10px",marginBottom:12}}>
                    <div style={{width:5,height:5,borderRadius:"50%",background:accent}}/>
                    <span style={{fontFamily:"var(--font-mono)",fontSize:9,color:accent,
                      letterSpacing:".2em",textTransform:"uppercase"}}>{cat.label}</span>
                  </div>
                  <div style={{width:1,height:28,background:`linear-gradient(${accent},transparent)`,marginLeft:2}}/>
                </div>
                {/* cards */}
                <div style={{flex:1,minWidth:280,display:"flex",flexWrap:"wrap",gap:14}}>
                  {members.map(m => <HierCard key={m.initials} m={m}/>)}
                </div>
              </M.div>
            );
          })}
        </M.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SPOTLIGHT PANEL — reusable for both Founder & CEO
═══════════════════════════════════════════════════════════════════════════ */
function SpotlightPanel({ person, missionLabel, missions, quote, stats, accentOverride }) {
  const accent = accentOverride || C.accent;

  return (
    <div style={{
      display:"flex",flexWrap:"wrap",borderRadius:20,overflow:"hidden",
      border:`1px solid ${C.border}`,
      boxShadow:`0 32px 80px rgba(0,0,0,.5), 0 0 0 1px ${accent}18`,
    }}>
      {/* ── LEFT portrait ── */}
      <div style={{flex:"0 0 300px",minWidth:220,
        background:`radial-gradient(ellipse at 50% 0%, ${accent}20 0%, #0b0e1a 100%)`,
        display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
        padding:"52px 28px",gap:20,position:"relative",overflow:"hidden",
        borderRight:`1px solid ${C.border}`}}>
        <DotGrid id={`dot-${person.initials}`} color={accent}/>
        {/* ambient glow */}
        <div style={{position:"absolute",top:"15%",left:"50%",transform:"translateX(-50%)",
          width:180,height:180,borderRadius:"50%",background:`${accent}20`,
          filter:"blur(40px)",pointerEvents:"none"}}/>

        <div className="float-el">
          <Avatar initials={person.initials} size={124} accent={accent} pulse/>
        </div>

        <div style={{textAlign:"center",position:"relative"}}>
          <p style={{fontFamily:"var(--font-display)",fontSize:19,fontWeight:800,
            color:C.textPri,letterSpacing:"-.01em",marginBottom:8}}>{person.name}</p>
          <div style={{display:"inline-flex",background:`${accent}18`,
            border:`1px solid ${accent}44`,borderRadius:20,padding:"5px 14px"}}>
            <span style={{fontFamily:"var(--font-mono)",fontSize:9,color:accent,
              letterSpacing:".18em",textTransform:"uppercase"}}>{person.title}</span>
          </div>
        </div>

        {/* stats */}
        {stats && (
          <div style={{display:"flex",gap:24,marginTop:4}}>
            {stats.map(s=>(
              <div key={s.lbl} style={{textAlign:"center"}}>
                <p style={{fontFamily:"var(--font-display)",fontSize:24,fontWeight:800,
                  color:accent,margin:0,letterSpacing:"-.02em"}}>{s.val}</p>
                <p style={{fontFamily:"var(--font-mono)",fontSize:8.5,color:C.textDim,
                  letterSpacing:".15em",textTransform:"uppercase",margin:0}}>{s.lbl}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── RIGHT vision ── */}
      <div style={{flex:1,minWidth:280,background:C.card,padding:"48px 44px"}}>
        <p style={{fontFamily:"var(--font-mono)",fontSize:9.5,color:C.accentLt,
          letterSpacing:".22em",textTransform:"uppercase",marginBottom:28}}>{missionLabel}</p>

        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {missions.map((item,i)=>(
            <M.div key={i}
              initial={{opacity:0,x:20}} whileInView={{opacity:1,x:0}}
              viewport={{once:true}} transition={{delay:i*.1,duration:.55,ease:[.22,1,.36,1]}}
              whileHover={{borderColor:accent+"55"}}
              style={{display:"flex",gap:16,alignItems:"flex-start",
                padding:"15px 18px",background:C.accentG2,
                border:`1px solid ${C.borderLo}`,borderRadius:12,cursor:"default",
                transition:"border-color .2s"}}>
              <div style={{width:26,height:26,borderRadius:8,flexShrink:0,
                background:C.accentGl,border:`1px solid ${accent}44`,
                display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontFamily:"var(--font-mono)",fontSize:10,fontWeight:700,color:C.accentLt}}>{i+1}</span>
              </div>
              <p style={{fontFamily:"var(--font-sans)",fontSize:13.5,color:C.textSec,lineHeight:1.75,margin:0}}>{item}</p>
            </M.div>
          ))}
        </div>

        {quote && (
          <div style={{marginTop:28,borderLeft:`2.5px solid ${accent}`,paddingLeft:18}}>
            <p style={{fontFamily:"var(--font-sans)",fontSize:13,color:C.textDim,
              fontStyle:"italic",lineHeight:1.72,margin:0}}>"{quote}"</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Founder Spotlight ─────────────────────────────────────────────────────── */
function FounderSpotlight() {
  return (
    <section style={{background:C.bg,padding:"0 24px 72px"}}>
      <div style={{maxWidth:1080,margin:"0 auto",paddingTop:96}}>
        <FV><Tag label="Founder"/><SectionTitle>Founder Spotlight</SectionTitle></FV>
        <div style={{height:36}}/>
        <FV>
          <SpotlightPanel
            person={{ initials:"RZ", name:"Rana Muhammad Zain ul Abideen", title:"Chairman & Founder" }}
            missionLabel="Founder's Mission for SCAFIS"
            accentOverride={C.accent}
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

/* ── CEO Spotlight ─────────────────────────────────────────────────────────── */
function CEOSpotlight() {
  return (
    <section style={{background:C.bg,padding:"0 24px 96px"}}>
      <div style={{maxWidth:1080,margin:"0 auto"}}>
        <FV><Tag label="Executive"/><SectionTitle>CEO Spotlight</SectionTitle></FV>
        <div style={{height:36}}/>
        <FV>
          <SpotlightPanel
            person={{ initials:"AK", name:"Ayesha Kashif", title:"CEO & Co-Founder" }}
            missionLabel="Strategic Operational Vision"
            accentOverride="#a78bfa"
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
   ADVISORS SECTION  — premium large cards
═══════════════════════════════════════════════════════════════════════════ */
const ADVISORS = [
  {
    initials: "MS",
    name: "Prof. Mohammad Saad Anwar",
    title: "Taxation Lawyer",
    accent: "#22d3ee",
    glow: "rgba(34,211,238,0.12)",
    expertise: ["Tax Law", "Analytics", "Regulatory"],
    desc: "Certified trainer and analytical innovation expert providing strategic oversight on SCAFIS's data pipelines and financial intelligence frameworks. Brings deep expertise in tax legislation and corporate advisory.",
    impact: [
      { val: "15+", lbl: "Years" },
      { val: "200+", lbl: "Cases" },
    ],
  },
  {
    initials: "MR",
    name: "Prof. Muhammed Rehan Anjum",
    title: "Accounting Specialist",
    accent: "#f59e0b",
    glow: "rgba(245,158,11,0.12)",
    expertise: ["IFRS", "Compliance", "Data Integrity"],
    desc: "Leads advisory on accounting standards and regulatory compliance, ensuring audit-grade accuracy across all SCAFIS modules. Authority on IFRS implementation and enterprise data governance.",
    impact: [
      { val: "18+", lbl: "Years" },
      { val: "300+", lbl: "Audits" },
    ],
  },
];

function AdvisorCard({ adv, idx }) {
  const [hov,setHov] = useState(false);
  return (
    <M.div
      initial="hidden" whileInView="show" viewport={{once:true,amount:.1}}
      variants={idx===0?left:right_v}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        flex:"1 1 320px",minWidth:300,
        background:hov?`linear-gradient(145deg,#13182e,${C.cardDeep})`:C.card,
        border:`1px solid ${hov?adv.accent+"55":C.border}`,
        borderRadius:20,overflow:"hidden",cursor:"default",
        transition:"all .32s cubic-bezier(.22,1,.36,1)",
        boxShadow:hov?`0 20px 60px ${adv.accent}22, 0 0 0 1px ${adv.accent}18`:"none",
      }}
    >
      {/* top accent bar */}
      <div style={{height:3,background:hov
        ?`linear-gradient(90deg,${adv.accent},${adv.accent}88,transparent)`
        :`linear-gradient(90deg,${adv.accent}44,transparent)`,
        transition:"all .32s"}}/>

      {/* header row */}
      <div style={{
        display:"flex",gap:20,alignItems:"flex-start",padding:"28px 28px 0",
        position:"relative",
      }}>
        {/* background glow */}
        <div style={{position:"absolute",top:-20,right:-20,width:140,height:140,
          borderRadius:"50%",background:hov?adv.glow:"transparent",
          filter:"blur(32px)",transition:"all .4s",pointerEvents:"none"}}/>

        <div style={{position:"relative"}}>
          <Avatar initials={adv.initials} size={80} accent={adv.accent}/>
          {/* online indicator */}
          <div style={{
            position:"absolute",bottom:2,right:2,width:14,height:14,
            borderRadius:"50%",background:adv.accent,
            border:`2px solid ${C.card}`,
            boxShadow:`0 0 8px ${adv.accent}`,
          }}/>
        </div>

        <div style={{flex:1,paddingTop:4}}>
          <p style={{fontFamily:"var(--font-display)",fontSize:16,fontWeight:800,
            color:C.textPri,letterSpacing:"-.01em",marginBottom:4}}>{adv.name}</p>
          <div style={{display:"inline-flex",
            background:`${adv.accent}18`,border:`1px solid ${adv.accent}44`,
            borderRadius:16,padding:"3px 12px",marginBottom:12}}>
            <span style={{fontFamily:"var(--font-mono)",fontSize:9,color:adv.accent,
              letterSpacing:".16em",textTransform:"uppercase"}}>{adv.title}</span>
          </div>
          {/* expertise tags */}
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {adv.expertise.map(tag=>(
              <span key={tag} style={{
                fontFamily:"var(--font-mono)",fontSize:8.5,color:C.textDim,
                background:C.accentG3,border:`1px solid ${C.border}`,
                borderRadius:8,padding:"2px 9px",letterSpacing:".1em",textTransform:"uppercase",
              }}>{tag}</span>
            ))}
          </div>
        </div>
      </div>

      {/* divider */}
      <div style={{height:1,background:`linear-gradient(90deg,transparent,${C.border},transparent)`,margin:"20px 28px"}}/>

      {/* description */}
      <div style={{padding:"0 28px"}}>
        <p style={{fontFamily:"var(--font-sans)",fontSize:13,color:C.textSec,lineHeight:1.78,margin:0}}>
          {adv.desc}
        </p>
      </div>

      {/* stats footer */}
      <div style={{
        display:"flex",gap:0,marginTop:24,
        borderTop:`1px solid ${C.border}`,
      }}>
        {adv.impact.map((s,i)=>(
          <div key={s.lbl} style={{
            flex:1,textAlign:"center",padding:"16px 12px",
            borderRight:i<adv.impact.length-1?`1px solid ${C.border}`:"none",
          }}>
            <p style={{fontFamily:"var(--font-display)",fontSize:22,fontWeight:800,
              color:hov?adv.accent:C.textPri,margin:0,transition:"color .25s"}}>{s.val}</p>
            <p style={{fontFamily:"var(--font-mono)",fontSize:8.5,color:C.textDim,
              letterSpacing:".15em",textTransform:"uppercase",margin:0}}>{s.lbl}</p>
          </div>
        ))}
        {/* advisory board label */}
        <div style={{flex:2,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px 16px"}}>
          <span style={{fontFamily:"var(--font-mono)",fontSize:8.5,color:C.textDim,
            letterSpacing:".12em",textTransform:"uppercase",textAlign:"center"}}>
            Academic Advisor<br/>SCAFIS Advisory Board
          </span>
        </div>
      </div>
    </M.div>
  );
}

function AdvisorsSection() {
  return (
    <section style={{background:C.bg,padding:"96px 24px",borderTop:`1px solid ${C.border}`}}>
      <div style={{maxWidth:1080,margin:"0 auto"}}>
        <FV>
          <Tag label="Advisory Board"/>
          <SectionTitle>Mentors &amp; Academic Advisors</SectionTitle>
          <p style={{fontFamily:"var(--font-sans)",fontSize:14,color:C.textSec,
            margin:"10px 0 52px",maxWidth:500,lineHeight:1.75}}>
            Distinguished academics and industry leaders who shape SCAFIS's intellectual and strategic foundation.
          </p>
        </FV>

        {/* connector SVG between cards */}
        <div style={{position:"relative"}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:20}}>
            {ADVISORS.map((adv,i)=>(
              <AdvisorCard key={adv.initials} adv={adv} idx={i}/>
            ))}
          </div>

          {/* bottom "Connection to Centre Links" label */}
          <FV style={{marginTop:20,textAlign:"center"}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:12}}>
              <div style={{width:32,height:1,background:C.border}}/>
              <span style={{fontFamily:"var(--font-mono)",fontSize:8.5,color:C.textDim,
                letterSpacing:".2em",textTransform:"uppercase"}}>
                Connection to Centre Links
              </span>
              <div style={{width:32,height:1,background:C.border}}/>
            </div>
          </FV>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TEAM MARQUEE
═══════════════════════════════════════════════════════════════════════════ */
const MARQUEE_DATA = [
  {initials:"RZ",name:"Rana Zain",   role:"Chairman",    dept:"Founder",  accent:C.accent},
  {initials:"AK",name:"Ayesha Kashif",role:"CEO",        dept:"Executive",accent:"#a78bfa"},
  {initials:"MS",name:"Prof. Saad",  role:"Tax Advisor", dept:"Advisory", accent:"#22d3ee"},
  {initials:"MR",name:"Prof. Rehan", role:"Compliance",  dept:"Advisory", accent:"#f59e0b"},
  {initials:"FA",name:"Farhan",      role:"Legal",       dept:"Team",     accent:C.green},
  {initials:"HT",name:"Team Member", role:"Engineering", dept:"Team",     accent:C.green},
  {initials:"SM",name:"Team Member", role:"Engineering", dept:"Team",     accent:C.green},
  {initials:"UA",name:"Team Member", role:"QA",          dept:"Team",     accent:C.green},
  {initials:"FN",name:"Team Member", role:"Finance",     dept:"Finance",  accent:C.amber},
  {initials:"ZK",name:"Team Member", role:"Accounts",    dept:"Finance",  accent:C.amber},
];

function MqCard({ p }) {
  const [hov,setHov]=useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{flexShrink:0,width:176,display:"flex",flexDirection:"column",
        alignItems:"center",gap:12,padding:"22px 18px",
        background:hov?`linear-gradient(160deg,#161b34,${C.cardDeep})`:C.card,
        border:`1px solid ${hov?p.accent+"55":C.border}`,
        borderRadius:16,margin:"0 9px",cursor:"default",
        transition:"all .25s cubic-bezier(.22,1,.36,1)",
        transform:hov?"scale(1.06)":"scale(1)",
        boxShadow:hov?`0 16px 40px ${p.accent}22`:"none"}}>
      <div style={{width:66,height:66,borderRadius:"50%",
        background:`radial-gradient(circle at 36% 36%,#252d52,${C.cardDeep})`,
        border:`2px solid ${hov?p.accent:C.border}`,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontFamily:"var(--font-display)",fontWeight:800,fontSize:17,
        color:hov?p.accent:C.textSec,transition:"all .25s",
        boxShadow:hov?`0 0 0 4px ${p.accent}22`:"none"}}>
        {p.initials}
      </div>
      <div style={{textAlign:"center"}}>
        <p style={{fontFamily:"var(--font-sans)",fontSize:12.5,fontWeight:600,
          color:hov?C.textPri:C.textSec,margin:"0 0 3px",transition:"color .2s"}}>{p.name}</p>
        <p style={{fontFamily:"var(--font-mono)",fontSize:9,color:hov?p.accent:C.textDim,
          letterSpacing:".1em",textTransform:"uppercase",margin:0,transition:"color .2s"}}>{p.role}</p>
      </div>
      <div style={{background:`${p.accent}18`,border:`1px solid ${p.accent}33`,
        borderRadius:10,padding:"2px 10px",
        fontFamily:"var(--font-mono)",fontSize:8,color:p.accent,letterSpacing:".12em",textTransform:"uppercase"}}>
        {p.dept}
      </div>
    </div>
  );
}

function TeamMarquee() {
  const doubled = [...MARQUEE_DATA,...MARQUEE_DATA];
  return (
    <section style={{background:C.cardDeep,padding:"88px 0",borderTop:`1px solid ${C.border}`,overflow:"hidden"}}>
      <div style={{maxWidth:1080,margin:"0 auto",padding:"0 24px",marginBottom:48}}>
        <FV>
          <Tag label="Full Team"/>
          <SectionTitle>Everyone Building SCAFIS</SectionTitle>
          <p style={{fontFamily:"var(--font-sans)",fontSize:14,color:C.textSec,lineHeight:1.7,
            maxWidth:400,margin:"8px 0 0"}}>Hover to pause · Each card glows on hover</p>
        </FV>
      </div>
      <div style={{position:"relative"}}>
        <div style={{position:"absolute",left:0,top:0,bottom:0,width:110,zIndex:2,
          background:`linear-gradient(90deg,${C.cardDeep},transparent)`,pointerEvents:"none"}}/>
        <div style={{position:"absolute",right:0,top:0,bottom:0,width:110,zIndex:2,
          background:`linear-gradient(-90deg,${C.cardDeep},transparent)`,pointerEvents:"none"}}/>
        <div className="mq-track" style={{display:"flex",alignItems:"stretch",width:"max-content"}}>
          {doubled.map((p,i)=><MqCard key={i} p={p}/>)}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ROOT
═══════════════════════════════════════════════════════════════════════════ */
export default function LeadershipPage() {
  return (
    <M.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      transition={{duration:.42}}
      style={{background:C.bg,minHeight:"100vh"}}>
      <AnimatePresence mode="wait">
        <Navbar/>
        <Hero/>
        <LeadershipHierarchy/>
        <FounderSpotlight/>
        <CEOSpotlight/>
        <AdvisorsSection/>
        <TeamMarquee/>
        <Footer/>
      </AnimatePresence>
    </M.div>
  );
}
