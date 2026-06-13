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
      <div className="flex h-screen w-screen items-center justify-center bg-[#faf9f8]">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-[#118DFF] border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-[#605e5c] text-[13px] font-semibold">Loading SARFIS...</p>
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
