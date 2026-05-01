import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Features from '../components/Features';
import HowItWorks from '../components/HowItWorks';
import Pricing from '../components/Pricing';
import AdvancedFeatures from '../components/AdvancedFeatures';
import Testimonials from '../components/Testimonials';
import FAQ from '../components/FAQ';
import CTA from '../components/CTA';
import Footer from '../components/Footer';

export default function LandingPage() {
  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      style={{ background: '#030b1a', minHeight: '100vh' }}
    >
      <Navbar />
      <Hero />

      {/* Thin section separator */}
      <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)' }} />

      <Features />
      <HowItWorks />
      <Pricing />
      <AdvancedFeatures />
      <Testimonials />
      <FAQ />
      <CTA />
      <Footer />
    </motion.div>
  );
}
