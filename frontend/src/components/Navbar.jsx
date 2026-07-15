import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Zap } from 'lucide-react';

const navLinks = [
  { label: 'Home', href: '/', isRoute: true },
  { label: 'Features', href: '/#features', isRoute: false },
  { label: 'Pricing', href: '/#pricing', isRoute: false },
  { label: 'About', href: '/about', isRoute: true },
  { label: 'Leadership', href: '/leadership', isRoute: true },
  { label: 'Contact', href: '/contact', isRoute: true },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <>
      <Motion.nav
        initial={{ y: -72, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-[#030b1a]/80 backdrop-blur-2xl border-b border-white/[0.05] shadow-[0_4px_32px_rgba(0,0,0,0.4)]'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
          <div className="flex items-center justify-between h-16 lg:h-[70px]">

            {/* Logo */}
            <Motion.div
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link to="/" className="flex items-center gap-2.5 group">
                <Motion.div
                  whileHover={{ rotate: 12, scale: 1.08 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                  className="w-8 h-8 rounded-[9px] flex items-center justify-center relative overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)' }}
                >
                  <div className="absolute inset-0 bg-white/20 rounded-[9px]" />
                  <Zap size={14} className="text-white fill-white relative z-10" />
                </Motion.div>
                <span
                  className="text-[17px] font-black text-white tracking-tight"
                  style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}
                >
                  SARFIS
                </span>
              </Link>
            </Motion.div>

            {/* Desktop links */}
            <Motion.div
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="hidden md:flex items-center gap-1"
            >
              {navLinks.map((link) => (
                <NavLink key={link.label} link={link} active={location.pathname === link.href} />
              ))}
            </Motion.div>

            {/* CTA */}
            <Motion.div
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="hidden md:flex items-center gap-3"
            >
              <Link
                to="/login"
                className="px-4 py-2 text-[13.5px] font-medium text-slate-400 hover:text-white transition-colors duration-200"
              >
                Sign in
              </Link>
              <Motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                <Link
                  to="/register"
                  className="relative inline-flex items-center gap-1.5 px-5 py-[9px] text-[13.5px] font-semibold text-white rounded-xl overflow-hidden group"
                  style={{ background: 'linear-gradient(135deg, #059669 0%, #0891b2 100%)' }}
                >
                  <span className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />
                  <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"
                    style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)', filter: 'blur(12px)' }} />
                  Get Started Free
                </Link>
              </Motion.div>
            </Motion.div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 text-slate-300 hover:text-white transition-colors rounded-lg hover:bg-white/[0.06]"
            >
              <AnimatePresence mode="wait" initial={false}>
                {mobileOpen ? (
                  <Motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <X size={20} />
                  </Motion.div>
                ) : (
                  <Motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <Menu size={20} />
                  </Motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </Motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <Motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed inset-0 z-40 pt-16 bg-[#030b1a]/98 backdrop-blur-2xl md:hidden"
          >
            <div className="px-6 py-8 space-y-1">
              {navLinks.map((link, i) => (
                <Motion.div
                  key={link.label}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.055, duration: 0.28 }}
                >
                  {link.isRoute ? (
                    <Link
                      to={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center px-4 py-3.5 text-base font-medium text-slate-200 hover:text-white rounded-xl hover:bg-white/[0.06] transition-all"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center px-4 py-3.5 text-base font-medium text-slate-200 hover:text-white rounded-xl hover:bg-white/[0.06] transition-all"
                    >
                      {link.label}
                    </a>
                  )}
                </Motion.div>
              ))}
              <Motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.32 }}
                className="pt-6 flex flex-col gap-3 border-t border-white/[0.07] mt-4"
              >
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="text-center px-4 py-3.5 text-sm font-medium text-slate-300 hover:text-white rounded-xl border border-white/10 hover:bg-white/[0.05] transition-all"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileOpen(false)}
                  className="text-center px-4 py-4 text-sm font-semibold text-white rounded-xl transition-all"
                  style={{ background: 'linear-gradient(135deg, #059669 0%, #0891b2 100%)' }}
                >
                  Get Started Free
                </Link>
              </Motion.div>
            </div>
          </Motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function NavLink({ link, active }) {
  return (
    <div className="relative group">
      {link.isRoute ? (
        <Link
          to={link.href}
          className={`relative px-4 py-2 text-[13.5px] font-medium transition-colors duration-200 rounded-lg hover:bg-white/[0.05] ${
            active ? 'text-white' : 'text-slate-300 hover:text-white'
          }`}
        >
          {link.label}
          <span className={`absolute bottom-0 left-4 right-4 h-[1.5px] rounded-full transition-all duration-300 ${
            active
              ? 'opacity-100 scale-x-100'
              : 'opacity-0 scale-x-0 group-hover:opacity-70 group-hover:scale-x-100'
          }`}
            style={{ background: 'linear-gradient(90deg, #10b981, #06b6d4)' }}
          />
        </Link>
      ) : (
        <a
          href={link.href}
          className="relative px-4 py-2 text-[13.5px] font-medium text-slate-300 hover:text-white transition-colors duration-200 rounded-lg hover:bg-white/[0.05]"
        >
          {link.label}
          <span className="absolute bottom-0 left-4 right-4 h-[1.5px] rounded-full opacity-0 scale-x-0 group-hover:opacity-70 group-hover:scale-x-100 transition-all duration-300"
            style={{ background: 'linear-gradient(90deg, #10b981, #06b6d4)' }}
          />
        </a>
      )}
    </div>
  );
}
