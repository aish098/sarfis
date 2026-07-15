import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Zap, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import logoImg from '../assets/logo/Logo 05.png';

export function AuthLayout({ children, title, subtitle, showBackToHome = true }) {
  return (
    <div className="min-h-screen relative flex items-center justify-center p-5 sm:p-8 overflow-hidden" style={{ background: '#030b1a' }}>
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '52px 52px' }} />
        <motion.div
           animate={{ scale: [1, 1.15, 1], opacity: [0.08, 0.15, 0.08] }}
           transition={{ duration: 10, repeat: Infinity }}
           className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full"
           style={{ background: 'radial-gradient(ellipse, #10b981 0%, transparent 70%)', filter: 'blur(80px)' }}
        />
      </div>

      {showBackToHome && (
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className="absolute top-6 left-6 z-20">
          <Link to="/" className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white rounded-xl border transition-all duration-200 bg-white/[0.02] hover:bg-white/[0.05]" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <ArrowLeft size={16} />
            Back to Home
          </Link>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[440px] relative z-10"
      >
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2 mb-6 group">
            <img src={logoImg} className="w-10 h-10 object-contain rounded-xl border border-white/10 transition-transform duration-300 group-hover:scale-105 bg-transparent" alt="ACCOUNTELLENCE Logo" />
            <span className="text-2xl font-black text-white uppercase" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>ACCOUNTELLENCE</span>
          </Link>
          
          <h2 className="text-3xl font-black text-white tracking-tight leading-snug mb-3" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
            {title}
          </h2>
          {subtitle && <p className="text-slate-400 text-[15px] leading-relaxed">{subtitle}</p>}
        </div>
        
        {children}
      </motion.div>
    </div>
  );
}

export function AuthWrapper({ children }) {
  return (
    <div
      className="p-8 sm:p-10 rounded-[24px] border relative overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]"
      style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)' }}
    >
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #10b981, #06b6d4)' }} />
      {children}
    </div>
  );
}

export function AuthInput({ id, name, type, value, onChange, placeholder, required = true, label }) {
  return (
    <div className="text-left select-none pb-1">
      <label htmlFor={id} className="block text-[13px] font-bold text-slate-300 mb-2 uppercase tracking-wider">
        {label} {required && <span className="text-rose-400">*</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={name}
        required={required}
        value={value}
        onChange={onChange}
        className="w-full px-4 py-3.5 rounded-xl border transition-all duration-200 outline-none text-[15px]"
        style={{
          background: 'rgba(255,255,255,0.03)',
          borderColor: 'rgba(255,255,255,0.08)',
          color: 'white',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = 'rgba(16,185,129,0.4)';
          e.target.style.background = 'rgba(16,185,129,0.03)';
          e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.08)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'rgba(255,255,255,0.08)';
          e.target.style.background = 'rgba(255,255,255,0.03)';
          e.target.style.boxShadow = 'none';
        }}
        placeholder={placeholder}
      />
    </div>
  );
}

export function AuthSelect({ id, name, value, onChange, label, children }) {
  return (
    <div className="text-left select-none pb-1">
      <label htmlFor={id} className="block text-[13px] font-bold text-slate-300 mb-2 uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          className="appearance-none w-full px-4 py-3.5 rounded-xl border transition-all duration-200 outline-none text-[15px] cursor-pointer"
          style={{
            background: 'rgba(255,255,255,0.03)',
            borderColor: 'rgba(255,255,255,0.08)',
            color: 'white',
          }}
          onFocus={(e) => {
             e.target.style.borderColor = 'rgba(16,185,129,0.4)';
             e.target.style.background = 'rgba(16,185,129,0.03)';
             e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.08)';
          }}
          onBlur={(e) => {
             e.target.style.borderColor = 'rgba(255,255,255,0.08)';
             e.target.style.background = 'rgba(255,255,255,0.03)';
             e.target.style.boxShadow = 'none';
          }}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
        </div>
      </div>
    </div>
  );
}

export function AuthButton({ type = 'submit', isLoading, disabled, children }) {
  return (
    <motion.button
      type={type}
      disabled={isLoading || disabled}
      whileHover={!(isLoading || disabled) ? { scale: 1.02 } : {}}
      whileTap={!(isLoading || disabled) ? { scale: 0.98 } : {}}
      className="w-full flex items-center justify-center py-4 px-4 text-[15px] font-bold text-white rounded-xl transition-all duration-300 relative overflow-hidden group disabled:opacity-60 disabled:cursor-not-allowed mt-2"
      style={{
        background: 'linear-gradient(135deg, #059669 0%, #0891b2 100%)',
        border: '1px solid rgba(255,255,255,0.05)'
      }}
    >
      <span className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />
      <span
         className="absolute -inset-1 opacity-0 group-hover:opacity-40 transition-opacity duration-500 blur-lg pointer-events-none"
         style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}
      />
      <span className="relative z-10 flex items-center justify-center gap-2">
        {isLoading && (
          <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
             <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
             <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </span>
    </motion.button>
  );
}

export function AuthError({ error }) {
  if (!error) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 p-4 rounded-xl border mb-5" style={{ background: 'rgba(244,63,94,0.06)', borderColor: 'rgba(244,63,94,0.2)' }}>
      <AlertCircle size={18} className="text-rose-400 mt-0.5 flex-shrink-0" />
      <p className="text-sm text-rose-300 font-medium leading-relaxed">{error}</p>
    </motion.div>
  );
}
