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
  const { fetchCurrentUser, token, isLoading } = useAuthStore();

  useEffect(() => {
    // Re-hydrate the session on mount if we have a token
    if (token) {
      fetchCurrentUser();
    }
  }, [token, fetchCurrentUser]);

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
