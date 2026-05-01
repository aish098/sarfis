import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, ArrowRight, CheckCircle2, ExternalLink, Hash, Briefcase, Users } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const contactCards = [
  {
    icon: Mail,
    title: 'Email Support',
    desc: 'Our friendly team is here to help.',
    value: 'support@SARFIS.com',
    href: 'mailto:support@SARFIS.com',
    color: '#10b981',
  },
  {
    icon: Phone,
    title: 'Phone',
    desc: 'Mon–Fri from 8am to 6pm EST.',
    value: '+1 (800) 555-0000',
    href: 'tel:+18005550000',
    color: '#06b6d4',
  },
  {
    icon: MapPin,
    title: 'Office Address',
    desc: '100 Innovation Drive, Suite 400',
    value: 'San Francisco, CA 94103',
    href: '#',
    color: '#8b5cf6',
  },
];

export default function ContactPage() {
  const [formState, setFormState] = useState('idle');
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormState('submitting');
    setTimeout(() => {
      setFormState('success');
      setTimeout(() => { setFormState('idle'); setForm({ name: '', email: '', subject: '', message: '' }); }, 5000);
    }, 1500);
  };

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

      {/* Hero */}
      <section className="pt-32 pb-20 px-5 sm:px-8 relative overflow-hidden text-center" style={{ background: '#030b1a' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)', backgroundSize: '52px 52px' }} />
          <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.08, 0.15, 0.08] }} transition={{ duration: 9, repeat: Infinity }} className="absolute top-0 right-0 w-[600px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 70%)', filter: 'blur(80px)', transform: 'translate(30%, -30%)' }} />
          <motion.div animate={{ scale: [1.1, 1, 1.1], opacity: [0.06, 0.12, 0.06] }} transition={{ duration: 11, repeat: Infinity, delay: 2 }} className="absolute bottom-0 left-0 w-[500px] h-[400px] rounded-full" style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)', filter: 'blur(80px)', transform: 'translate(-30%, 30%)' }} />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)' }} />

        <div className="relative z-10 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold mb-7"
            style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.25)', color: '#6ee7b7' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ animation: 'pulse 2s infinite' }} />
            Our team is online
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="text-5xl sm:text-6xl font-black text-white tracking-tight mb-5"
            style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}
          >
            Contact Our Team
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.28 }}
            className="text-lg text-slate-400 max-w-xl mx-auto leading-relaxed"
          >
            We're here to help you manage your finances smarter. Reach out to our experts for support, tailored pricing, or partnership opportunities.
          </motion.p>
        </div>
      </section>

      {/* Form + Cards */}
      <section className="px-5 sm:px-8 py-20">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-5 gap-8 lg:gap-12">

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.2 }}
            className="lg:col-span-3"
          >
            <div
              className="relative p-8 sm:p-10 rounded-2xl border h-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.08)' }}
            >
              {/* Top accent */}
              <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl" style={{ background: 'linear-gradient(90deg, #059669, #0891b2)' }} />

              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}>Send us a message</h2>
                <p className="text-slate-500 text-sm">We'll get back to you within 24 hours.</p>
              </div>

              {formState === 'success' ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ background: 'rgba(16,185,129,0.15)' }}>
                    <CheckCircle2 size={32} className="text-emerald-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Message Sent!</h3>
                  <p className="text-slate-400">Thank you for reaching out. Our team will contact you shortly.</p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <FormField label="Full Name" required>
                      <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Jane Doe" className="form-input" />
                    </FormField>
                    <FormField label="Email Address" required>
                      <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required placeholder="jane@company.com" className="form-input" />
                    </FormField>
                  </div>
                  <FormField label="Subject">
                    <input type="text" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="How can we help you?" className="form-input" />
                  </FormField>
                  <FormField label="Message" required>
                    <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} required rows={5} placeholder="Tell us more about your needs..." className="form-input resize-none" />
                  </FormField>

                  <motion.button
                    type="submit"
                    disabled={formState === 'submitting'}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center justify-center gap-2.5 py-4 text-sm font-semibold text-white rounded-xl transition-all duration-300 relative overflow-hidden group disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <span className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.04] transition-colors duration-300" />
                    {formState === 'submitting' ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        Send Message
                        <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform duration-200" />
                      </>
                    )}
                  </motion.button>
                </form>
              )}

              <style>{`
                .form-input {
                  width: 100%;
                  padding: 12px 16px;
                  background: rgba(255,255,255,0.04);
                  border: 1px solid rgba(255,255,255,0.08);
                  border-radius: 12px;
                  color: white;
                  font-size: 14px;
                  transition: all 0.2s;
                  outline: none;
                }
                .form-input::placeholder { color: rgba(148,163,184,0.5); }
                .form-input:focus { border-color: rgba(16,185,129,0.4); background: rgba(16,185,129,0.04); box-shadow: 0 0 0 3px rgba(16,185,129,0.08); }
              `}</style>
            </div>
          </motion.div>

          {/* Contact info cards */}
          <div className="lg:col-span-2 space-y-4 mt-12 lg:mt-0">
            {contactCards.map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.55, delay: 0.25 + i * 0.1 }}
                whileHover={{ y: -3 }}
                className="group flex items-start gap-5 p-6 rounded-2xl border transition-all duration-300"
                style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.07)' }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
                  style={{ background: `${card.color}12` }}
                >
                  <card.icon size={22} style={{ color: card.color }} />
                </div>
                <div>
                  <h3 className="font-bold text-white mb-1 text-[15px]" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>{card.title}</h3>
                  <p className="text-slate-500 text-xs mb-1.5">{card.desc}</p>
                  <a href={card.href} className="text-sm font-semibold transition-colors duration-200 hover:underline" style={{ color: card.color }}>
                    {card.value}
                  </a>
                </div>
              </motion.div>
            ))}

            {/* Social */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, delay: 0.55 }}
              className="p-6 rounded-2xl border"
              style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)' }}
            >
              <h4 className="text-sm font-bold text-white mb-4" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Connect With Us</h4>
              <div className="flex gap-3">
                {[{ icon: Briefcase, color: '#0A66C2' }, { icon: Hash, color: '#1DA1F2' }, { icon: Users, color: '#1877F2' }].map((s, i) => (
                  <motion.a
                    key={i}
                    href="#"
                    whileHover={{ scale: 1.1, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center border text-slate-500 hover:text-white transition-all duration-200"
                    style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}
                  >
                    <s.icon size={16} />
                  </motion.a>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Map placeholder */}
      <section className="px-5 sm:px-8 pb-20">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative w-full h-[380px] rounded-2xl border overflow-hidden group"
            style={{ borderColor: 'rgba(255,255,255,0.07)' }}
          >
            <img
              src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=1600"
              alt="Office location map"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              style={{ filter: 'grayscale(100%) brightness(0.35) contrast(1.2)' }}
            />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(3,11,26,0.7) 0%, transparent 60%)' }} />

            {/* Pin */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                className="relative"
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center z-10 relative cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #059669, #0891b2)', boxShadow: '0 4px 20px rgba(16,185,129,0.4)' }}
                >
                  <MapPin size={22} className="text-white fill-white" />
                </div>
                <div className="absolute inset-0 rounded-full animate-ping opacity-25" style={{ background: '#10b981' }} />
              </motion.div>
            </div>

            {/* Info box */}
            <div
              className="absolute bottom-5 left-5 px-5 py-3.5 rounded-xl border"
              style={{ background: 'rgba(3,11,26,0.92)', borderColor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)' }}
            >
              <div className="text-white font-bold text-sm" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>SARFIS HQ</div>
              <div className="text-slate-400 text-xs mt-0.5">San Francisco, CA</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Help / Social strip */}
      <section className="px-5 sm:px-8 pb-20">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="flex flex-col lg:flex-row items-start lg:items-center gap-8 p-8 rounded-2xl border"
            style={{ background: 'rgba(16,185,129,0.04)', borderColor: 'rgba(16,185,129,0.12)' }}
          >
            <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.12)' }}>
              <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Need Help?</h3>
              <p className="text-slate-400 text-sm mb-3 max-w-lg">Can't find what you're looking for? Visit our robust Help Center for setup guides, FAQs, and extensive documentation.</p>
              <a href="#" className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors duration-200 group">
                Visit Help Center
                <ExternalLink size={14} className="group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform duration-200" />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </motion.div>
  );
}

function FormField({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
        {label} {required && <span className="text-rose-400">*</span>}
      </label>
      {children}
    </div>
  );
}
