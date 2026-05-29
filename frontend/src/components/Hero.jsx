import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion as M, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowRight, Menu, X, ArrowUpRight } from "lucide-react";
import ShinyText from "./ShinyText";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about" },
  { label: "Courses", href: "/courses" },
  { label: "Instructors", href: "/instructors" },
  { label: "Testimonials", href: "/testimonials" },
  { label: "Blog", href: "/blog" },
  { label: "Contact us", href: "/contact", isContact: true },
];

export default function Hero() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Body scroll lock when menu opens
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <section className="relative h-screen w-full bg-black overflow-hidden flex flex-col font-sans select-none">
      {/* 1. Optimized Full-Screen Loop Video Background */}
      <div className="absolute inset-0 w-full h-full z-0 pointer-events-none bg-black">
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          className="w-full h-full object-cover"
        >
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_105406_16f4600d-7a92-4292-b96e-b19156c7830a.mp4"
            type="video/mp4"
          />
        </video>
        {/* Layered cinematic gradients + dark overlay for maximum readability */}
        <div className="absolute inset-0 bg-black/55 animate-fade-in" />
        <div className="absolute top-0 inset-x-0 h-1/3 bg-gradient-to-b from-black via-black/40 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-black via-black/40 to-transparent" />
      </div>

      {/* 2. Navigation Bar */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between pointer-events-auto">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center transition-transform duration-300 group-hover:rotate-12">
            <div className="w-2.5 h-2.5 rounded-full bg-white" />
          </div>
          <span className="font-bold text-white text-lg tracking-tight">DesignPro</span>
        </Link>

        {/* Desktop Rounded Pill Nav links */}
        <nav className="hidden lg:flex items-center gap-6 px-6 py-2.5 rounded-full border border-gray-700 bg-black/40 backdrop-blur-md">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className="text-sm font-medium text-white/80 hover:text-white transition-colors duration-200 flex items-center gap-1"
            >
              {link.label}
              {link.isContact && <ArrowUpRight size={13} className="opacity-80" />}
            </Link>
          ))}
        </nav>

        {/* Mobile Hamburger menu */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 text-white hover:text-white/80 transition-colors focus:outline-none"
          aria-label="Toggle Menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* 3. Content Layout */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 flex-1 flex flex-col justify-between pb-12 pointer-events-none">
        
        {/* Top Section (below nav) */}
        <div className="w-full pt-4 pointer-events-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 w-full border-t border-gray-900/60 pt-6">
            <p className="text-white/80 text-sm lg:text-base max-w-xl leading-relaxed">
              We deliver transformative programs that empower emerging product designers with cutting-edge expertise and vision to thrive globally.
            </p>
            <p className="text-white/80 text-sm lg:text-base lg:text-right font-medium flex items-center lg:justify-end">
              8000+ Talented Designers Launched !
            </p>
          </div>
        </div>

        {/* Center Hero Section */}
        <div className="flex-1 flex flex-col justify-center items-center text-center pointer-events-auto">
          {/* Seats notices */}
          <span className="text-white/80 text-xs lg:text-sm uppercase tracking-tight mb-4 font-semibold">
            Seats for Next Program Opening Soon
          </span>
          
          {/* Main Heading */}
          <h1 className="text-[clamp(3rem,8vw,9rem)] leading-[0.85] tracking-tighter flex flex-col items-center mb-10 font-bold">
            <span className="text-white font-medium mb-1">Become</span>
            <ShinyText
              text="Product Leader."
              baseColor="#64CEFB"
              shineColor="#ffffff"
              speed={3}
              spread={100}
            />
          </h1>

          {/* CTA Button */}
          <M.div
            whileHover={shouldReduceMotion ? {} : { scale: 1.03 }}
            whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
          >
            <Link
              to="/apply"
              className="group inline-flex items-center gap-2.5 px-7 md:px-9 py-3.5 md:py-4 bg-black hover:bg-neutral-900 text-white font-semibold rounded-full border border-gray-800 transition-all duration-300 hover:shadow-[0_0_20px_rgba(100,206,251,0.2)] text-sm md:text-base"
            >
              Apply for Next Enrollment
              <ArrowRight
                size={16}
                className="group-hover:translate-x-1 transition-transform duration-200"
              />
            </Link>
          </M.div>
        </div>

        {/* Bottom spacing helper */}
        <div className="h-4" />
      </div>

      {/* 4. Mobile Navigation Drawer Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <M.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="absolute inset-0 z-15 bg-black flex flex-col lg:hidden px-6 pt-24 pb-10"
          >
            {/* Background layered gradients for drawer readability */}
            <div className="absolute inset-0 bg-black/90 pointer-events-none z-0" />
            
            <nav className="relative z-10 flex flex-col gap-6 items-center justify-center flex-1">
              {NAV_LINKS.map((link, idx) => (
                <M.div
                  key={link.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Link
                    to={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-2xl font-semibold text-white/80 hover:text-white transition-colors duration-200 flex items-center gap-2"
                  >
                    {link.label}
                    {link.isContact && <ArrowUpRight size={20} className="opacity-80" />}
                  </Link>
                </M.div>
              ))}
            </nav>

            <div className="relative z-10 w-full text-center text-white/40 text-xs mt-auto">
              © {new Date().getFullYear()} DesignPro. All rights reserved.
            </div>
          </M.div>
        )}
      </AnimatePresence>
    </section>
  );
}
