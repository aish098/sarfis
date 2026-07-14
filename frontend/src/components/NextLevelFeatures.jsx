import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, Hourglass, DollarSign, Calculator, RefreshCw, BarChart2 } from 'lucide-react';

const AI_PROMPTS = [
  { 
    q: "Analyze salaries expense variance for Q2", 
    a: "Here is the salaries expense breakdown for Q2 2026. Salaries increased by 12% in June due to seasonal payroll additions. Total variance is within the 95% warning threshold.",
    type: 'chart',
    data: [
      { label: 'Apr 2026', value: 'PKR 180K' },
      { label: 'May 2026', value: 'PKR 180K' },
      { label: 'Jun 2026', value: 'PKR 202K' }
    ]
  },
  { 
    q: "List all blacklisted vendors under Watchlist", 
    a: "Found 1 vendor matching 'Watchlist' status with high credit risk parameters:",
    type: 'table',
    data: [
      { code: 'VND-209', name: 'Apex Wholesale Corp', score: '75/100', status: 'Watchlist', limit: 'Cash Only' }
    ]
  },
  { 
    q: "What is our current cash-to-liability ratio?", 
    a: "Your current liquidity ratio is 1.84. This indicates a healthy short-term solvency position. Cash reserves (PKR 7.5M) cover immediate current liabilities (PKR 4.05M).",
    type: 'text',
    data: null
  }
];

export default function NextLevelFeatures() {
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [chatHistory, setChatHistory] = useState([
    { role: 'assistant', text: "Hello! I am your SARFIS AI assistant. Click one of the quick queries below to see how I can analyze your ledger, payroll, and compliance status in real-time." }
  ]);

  // Savings Calculator States
  const [employees, setEmployees] = useState(25);
  const [hoursSpent, setHoursSpent] = useState(15);
  const [hourlyRate, setHourlyRate] = useState(1500); // PKR per hour

  // Calculator computations
  const weeklySavings = hoursSpent * 0.8 * hourlyRate; // 80% automation gain
  const annualSavings = weeklySavings * 52;
  const hoursGained = Math.round(hoursSpent * 0.8 * 52);

  const handlePromptClick = (prompt) => {
    if (isTyping) return;
    
    // Add user query to chat
    setChatHistory(prev => [...prev, { role: 'user', text: prompt.q }]);
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        text: prompt.a,
        type: prompt.type,
        data: prompt.data
      }]);
    }, 1200);
  };

  const clearChat = () => {
    setChatHistory([
      { role: 'assistant', text: "Hello! I am your SARFIS AI assistant. Click one of the quick queries below to see how I can analyze your ledger, payroll, and compliance status in real-time." }
    ]);
  };

  return (
    <section className="py-28 px-5 sm:px-8 relative overflow-hidden bg-[#030b1a] border-y border-slate-900">
      
      {/* Background spotlights */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 right-1/4 w-[600px] h-[300px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[300px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.03) 0%, transparent 70%)', filter: 'blur(90px)' }} />
      </div>

      <div className="max-w-7xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
        
        {/* Left Side: Interactive AI Assistant Simulator */}
        <div className="space-y-6">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold mb-5 uppercase tracking-wider"
              style={{ background: 'rgba(236,72,153,0.07)', borderColor: 'rgba(236,72,153,0.22)', color: '#f472b6' }}>
              <Sparkles size={13} className="text-pink-400 fill-pink-400 animate-pulse" /> AI-Ready ERP
            </div>
            <h2 className="text-4xl font-black text-white tracking-tight leading-tight mb-4"
              style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
              Conversational AI Ledger Assistant
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-lg">
              SARFIS features structured API endpoints that enable semantic AI queries. Finance managers can audit ledgers, verify payroll variances, and check vendor risks using plain language.
            </p>
          </div>

          {/* Interactive Chat Mockup */}
          <div className="bg-[#050f21] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[420px]">
            {/* Header bar */}
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-400">
                  <Sparkles size={15} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white leading-none">SARFIS AI Assistant</h4>
                  <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider block mt-1">Ready</span>
                </div>
              </div>
              <button 
                onClick={clearChat}
                className="text-slate-500 hover:text-slate-300 text-[10px] font-bold bg-transparent border-none cursor-pointer flex items-center gap-1"
              >
                <RefreshCw size={10} /> Clear
              </button>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 font-sans text-xs scrollbar-thin scrollbar-thumb-slate-800">
              <AnimatePresence>
                {chatHistory.map((chat, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[85%] p-3.5 rounded-2xl leading-relaxed text-left ${
                        chat.role === 'user' 
                          ? 'bg-pink-600 text-white font-semibold' 
                          : 'bg-slate-900 border border-slate-800 text-slate-300'
                      }`}
                    >
                      <p>{chat.text}</p>
                      
                      {/* Dynamic Chart response */}
                      {chat.type === 'chart' && chat.data && (
                        <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                          {chat.data.map((bar, i) => (
                            <div key={i} className="space-y-1">
                              <div className="flex justify-between text-[10px] text-slate-400">
                                <span>{bar.label}</span>
                                <span className="font-bold text-white">{bar.value}</span>
                              </div>
                              <div className="h-2 bg-slate-950 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: i === 2 ? '100%' : '88%' }}
                                  transition={{ duration: 0.6 }}
                                  className="h-full bg-pink-500" 
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Dynamic Table response */}
                      {chat.type === 'table' && chat.data && (
                        <div className="mt-4 border border-slate-800 rounded-xl overflow-hidden bg-slate-950 text-[10.5px]">
                          {chat.data.map((row, i) => (
                            <div key={i} className="p-3 space-y-1 text-slate-300">
                              <div className="flex justify-between border-b border-slate-900 pb-1">
                                <span className="text-slate-500">Name</span>
                                <span className="font-bold text-white">{row.name}</span>
                              </div>
                              <div className="flex justify-between border-b border-slate-900 pb-1">
                                <span className="text-slate-500">Score</span>
                                <span className="text-amber-400 font-bold">{row.score}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">Restriction</span>
                                <span className="bg-rose-950 text-rose-400 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider">{row.limit}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}

                {isTyping && (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="flex justify-start"
                  >
                    <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '0.15s' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '0.3s' }} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Prompt Selector footer */}
            <div className="p-4 bg-slate-950/80 border-t border-slate-850 space-y-2">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Suggested Queries:</span>
              <div className="flex flex-wrap gap-2">
                {AI_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handlePromptClick(p)}
                    className="bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white px-3 py-2 rounded-xl text-[10.5px] font-medium border border-slate-800 transition active:scale-95 cursor-pointer"
                  >
                    "{p.q}"
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Right Side: Enterprise Savings & ROI Calculator */}
        <div className="space-y-6">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold mb-5 uppercase tracking-wider"
              style={{ background: 'rgba(16,185,129,0.07)', borderColor: 'rgba(16,185,129,0.22)', color: '#6ee7b7' }}>
              <Calculator size={13} className="text-emerald-400" /> ROI Calculator
            </div>
            <h2 className="text-4xl font-black text-white tracking-tight leading-tight mb-4"
              style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
              Compute Your Savings Instantly
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-lg">
              SARFIS automates the routine tasks that absorb hours of financial workflow. Drag the sliders below to estimate your company savings.
            </p>
          </div>

          {/* Interactive Calculator */}
          <div className="bg-[#050f21] border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
            
            {/* Sliders */}
            <div className="space-y-5 text-xs">
              <div>
                <div className="flex justify-between text-slate-300 font-semibold mb-2">
                  <span>Weekly Manual Accounting Hours</span>
                  <span className="text-emerald-400 font-bold">{hoursSpent} Hours</span>
                </div>
                <input 
                  type="range" 
                  min="5" 
                  max="100" 
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  value={hoursSpent}
                  onChange={e => setHoursSpent(parseInt(e.target.value, 10))}
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 font-semibold mb-2">
                  <span>Finance Employee Hourly Rate (Avg)</span>
                  <span className="text-emerald-400 font-bold">PKR {hourlyRate.toLocaleString()} / hr</span>
                </div>
                <input 
                  type="range" 
                  min="500" 
                  max="5000" 
                  step="100"
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  value={hourlyRate}
                  onChange={e => setHourlyRate(parseInt(e.target.value, 10))}
                />
              </div>
            </div>

            {/* Results Cards */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800 text-xs">
              <div className="p-4 bg-slate-950 border border-slate-850 rounded-2xl text-left">
                <div className="flex items-center gap-1.5 text-[9.5px] text-slate-400 font-bold uppercase tracking-wider mb-2">
                  <Hourglass size={12} className="text-emerald-400" /> Time Reclaimed
                </div>
                <div className="text-2xl font-black text-white leading-none mb-1 font-mono">{hoursGained} hrs</div>
                <span className="text-[10px] text-slate-500">annualized time saved</span>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-850 rounded-2xl text-left">
                <div className="flex items-center gap-1.5 text-[9.5px] text-slate-400 font-bold uppercase tracking-wider mb-2">
                  <DollarSign size={12} className="text-emerald-400" /> Cost Savings
                </div>
                <div className="text-2xl font-black text-emerald-400 leading-none mb-1 font-mono">
                  PKR {Math.round(annualSavings / 1000)}K
                </div>
                <span className="text-[10px] text-slate-500">annualized cash saved</span>
              </div>
            </div>

            {/* ROI badge info */}
            <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-black font-mono text-xs">
                80%
              </div>
              <p className="text-[11.5px] text-emerald-300 leading-relaxed font-semibold">
                SARFIS automates 80% of data entry, ledger posting, and reconciliation. Based on your inputs, your business will save approximately **PKR {annualSavings.toLocaleString()}** annually.
              </p>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
