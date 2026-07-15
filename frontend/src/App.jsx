import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

// Pages
import LandingPage from './pages/LandingPage';
import AboutPage from './pages/AboutPage';
import LeadershipPage from './pages/LeadershipPage';
import ContactPage from './pages/ContactPage';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import useAuthStore from './store/authStore';

import ProtectedRoute from './components/ProtectedRoute';

function AnimatedRoutes() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/leadership" element={<LeadershipPage />} />
        <Route path="/contact" element={<ContactPage />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard/*" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  const { fetchCurrentUser, token, isLoading, settings } = useAuthStore();

  useEffect(() => {
    // Re-hydrate the session on mount if we have a token
    if (token) {
      fetchCurrentUser();
    }
  }, [token, fetchCurrentUser]);

  useEffect(() => {
    if (!settings?.accentColor) return;
    
    const darkenHex = (hex, percent) => {
      let num = parseInt(hex.replace("#",""), 16),
      amt = Math.round(2.55 * percent),
      R = (num >> 16) - amt,
      G = (num >> 8 & 0x00FF) - amt,
      B = (num & 0x0000FF) - amt;
      return "#" + (0x1000000 + (R<255?R<0?0:R:255)*0x10000 + (G<255?G<0?0:G:255)*0x100 + (B<255?B<0?0:B:255)).toString(16).slice(1);
    };

    const brandColor = settings.accentColor;
    const hoverColor = darkenHex(brandColor, 10);
    const lightColor = brandColor + '15'; // 8% opacity
    const borderLight = brandColor + '30'; // 18% opacity
    
    let styleEl = document.getElementById('dynamic-brand-styles');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'dynamic-brand-styles';
      document.head.appendChild(styleEl);
    }
    
    styleEl.innerHTML = `
      :root {
        --brand-primary: ${brandColor} !important;
        --brand-primary-hover: ${hoverColor} !important;
        --brand-primary-light: ${lightColor} !important;
        --brand-primary-border: ${borderLight} !important;
      }
      
      .bg-emerald-500, .bg-[#10b981], .bg-emerald-600 {
        background-color: var(--brand-primary) !important;
      }
      .hover\\:bg-emerald-600:hover, .hover\\:bg-[#059669]:hover, .hover\\:bg-emerald-700:hover {
        background-color: var(--brand-primary-hover) !important;
      }
      .text-emerald-600, .text-emerald-500, .text-[#10b981] {
        color: var(--brand-primary) !important;
      }
      .border-emerald-500, .border-[#10b981] {
        border-color: var(--brand-primary) !important;
      }
      .bg-emerald-50, .bg-emerald-500\\/10 {
        background-color: var(--brand-primary-light) !important;
      }
      .text-emerald-700, .text-emerald-800 {
        color: var(--brand-primary) !important;
      }
      .border-emerald-100 {
        border-color: var(--brand-primary-border) !important;
      }
    `;
  }, [settings?.accentColor]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#f4f6f8]">
        <div className="bg-white/80 backdrop-blur-md border border-slate-200/50 rounded-3xl p-10 flex flex-col items-center shadow-xl shadow-slate-900/5 max-w-sm w-full mx-4">
          <div className="relative w-14 h-14 mb-5">
            {/* Outer glowing pulsing ring */}
            <div className="absolute inset-0 rounded-full border-[3px] border-emerald-500/20 animate-pulse"></div>
            {/* Inner rotating gradient arc */}
            <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-emerald-600 border-r-emerald-600 animate-spin"></div>
          </div>
          <h2 className="text-[16px] font-black text-slate-950 tracking-tight">S A R F I S</h2>
          <p className="mt-2 text-slate-500 text-[12px] font-medium tracking-wide">Syncing enterprise ledger...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  );
}
