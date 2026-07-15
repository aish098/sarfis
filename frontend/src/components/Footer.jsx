import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, ShieldCheck, Globe, Hash, Briefcase, Users } from 'lucide-react';
import logoImg from '../assets/logo/Logo 05.png';

const footerLinks = {
  Product: [
    { label: 'Features', href: '/#features', isRoute: false },
    { label: 'Pricing', href: '/#pricing', isRoute: false },
    { label: 'Enterprise', href: '#', isRoute: false },
    { label: 'Changelog', href: '#', isRoute: false },
  ],
  Company: [
    { label: 'About Us', href: '/about', isRoute: true },
    { label: 'Careers', href: '#', isRoute: false },
    { label: 'Blog', href: '#', isRoute: false },
    { label: 'Contact', href: '/contact', isRoute: true },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '#', isRoute: false },
    { label: 'Terms of Service', href: '#', isRoute: false },
    { label: 'Cookie Policy', href: '#', isRoute: false },
    { label: 'Security', href: '#', isRoute: false },
  ],
};

const socials = [
  { icon: Briefcase, href: '#', label: 'LinkedIn' },
  { icon: Hash, href: '#', label: 'Twitter' },
  { icon: Users, href: '#', label: 'Facebook' },
];

export default function Footer() {
  return (
    <footer className="border-t" style={{ background: '#020810', borderTopColor: 'rgba(255,255,255,0.05)' }}>

      {/* Pre-footer CTA strip */}
      <div
        className="border-b px-5 sm:px-8 py-6"
        style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(16,185,129,0.03)' }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-1">Ready to Build</div>
            <p className="text-white font-bold text-lg">Reliable finance operations start here.</p>
          </div>
          <div className="flex gap-3">
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl relative overflow-hidden group"
                style={{ background: 'linear-gradient(135deg, #059669 0%, #0891b2 100%)' }}
              >
                <span className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />
                Get Started
                <Zap size={13} className="fill-white relative z-10" />
              </Link>
            </motion.div>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-300 hover:text-white rounded-xl border transition-all duration-200 hover:bg-white/[0.05]"
              style={{ borderColor: 'rgba(255,255,255,0.1)' }}
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-16 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 pb-14 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          {/* Brand */}
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2.5 mb-5 group w-fit">
              <motion.img
                whileHover={{ rotate: 8, scale: 1.05 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                src={logoImg}
                alt="ACCOUNTELLENCE Logo"
                className="w-8 h-8 object-contain rounded-lg flex-shrink-0 bg-transparent"
              />
              <span
                className="text-[17px] font-black text-white uppercase"
                style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}
              >
                ACCOUNTELLENCE
              </span>
            </Link>
            <p className="text-slate-500 text-sm leading-relaxed mb-5 max-w-[240px]">
              Smart Cloud Accounting & Financial Intelligence System built for modern enterprise finance teams.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-700 mb-5">
              <ShieldCheck size={13} className="text-emerald-800" />
              <span>SOC 2 · IFRS · GAAP · AES-256</span>
            </div>
            {/* Socials */}
            <div className="flex gap-2">
              {socials.map((s) => (
                <motion.a
                  key={s.label}
                  href={s.href}
                  whileHover={{ scale: 1.1, y: -1 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label={s.label}
                  className="w-9 h-9 rounded-lg flex items-center justify-center border transition-all duration-200 hover:border-slate-600 text-slate-600 hover:text-slate-300"
                  style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}
                >
                  <s.icon size={15} />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4
                className="text-xs font-black text-white uppercase tracking-widest mb-5"
                style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
              >
                {category}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.isRoute ? (
                      <Link
                        to={link.href}
                        className="text-sm text-slate-500 hover:text-slate-300 transition-colors duration-200"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="text-sm text-slate-500 hover:text-slate-300 transition-colors duration-200"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8">
          <span className="text-xs text-slate-700">
            © {new Date().getFullYear()} ACCOUNTELLENCE. All rights reserved.
          </span>
          <div className="flex items-center gap-1.5 text-xs text-slate-700">
            <Globe size={12} className="text-slate-700" />
            <span>Built for reliable finance operations.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
