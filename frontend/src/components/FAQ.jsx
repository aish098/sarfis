import { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const faqs = [
  { q: 'What is ACCOUNTELLENCE?', a: 'ACCOUNTELLENCE stands for Smart Accounting & Real-time Financial Intelligence System. It\'s an all-in-one platform for accounting cycle automation, financial reporting, and AI-powered analytics.' },
  { q: 'Is my data secure?', a: 'Yes, absolutely. We use AES-256 encryption for data at rest and in transit, JWT for secure authentication, and strict multi-tenant data isolation to ensure your financial data is always protected.' },
  { q: 'How does pricing work?', a: 'We offer flexible SaaS packages designed to scale with your business, including Free, Pro, and Enterprise tiers. You can find detailed features for each plan on our pricing section and upgrade at any time.' },
  { q: 'Can I upgrade or downgrade my plan?', a: 'Yes, you can change your plan at any time directly from your account dashboard. Your billing will be prorated automatically.' },
  { q: 'What kind of support do you offer?', a: 'We offer 24/7 email support for all plans. Pro and Enterprise plans include priority phone and dedicated account manager support.' },
  { q: 'Do you offer a mobile app?', a: 'Currently, ACCOUNTELLENCE is optimized for desktop and tablet browsers. A native mobile app for iOS and Android is on our roadmap.' },
];

export default function FAQ() {
  const [open, setOpen] = useState(null);

  return (
    <section className="py-28 px-5 sm:px-8" style={{ background: '#030b1a' }}>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <Motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold mb-6"
            style={{ background: 'rgba(16,185,129,0.07)', borderColor: 'rgba(16,185,129,0.22)', color: '#6ee7b7' }}
          >
            FAQ
          </Motion.div>
          <Motion.h2
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4"
            style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}
          >
            Frequently Asked Questions
          </Motion.h2>
          <Motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.14 }}
            className="text-slate-400 text-lg"
          >
            Can't find your answer?{' '}
            <a href="/contact" className="text-emerald-400 hover:text-emerald-300 transition-colors duration-200">
              Talk to our team
            </a>
          </Motion.p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <Motion.div
              key={i}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.06, duration: 0.45 }}
            >
              <div
                className={`rounded-2xl border cursor-pointer overflow-hidden transition-all duration-300 ${
                  open === i ? 'border-emerald-500/30' : 'hover:border-white/12'
                }`}
                style={{
                  background: open === i ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.025)',
                  borderColor: open === i ? 'rgba(16,185,129,0.28)' : 'rgba(255,255,255,0.07)',
                }}
                onClick={() => setOpen(open === i ? null : i)}
              >
                <div className="flex justify-between items-center px-6 py-5 gap-4">
                  <span
                    className="font-semibold text-white text-[15px]"
                    style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}
                  >
                    {faq.q}
                  </span>
                  <Motion.div
                    animate={{ rotate: open === i ? 180 : 0 }}
                    transition={{ duration: 0.22 }}
                    className="flex-shrink-0"
                  >
                    <ChevronDown size={18} className={open === i ? 'text-emerald-400' : 'text-slate-500'} />
                  </Motion.div>
                </div>
                <AnimatePresence initial={false}>
                  {open === i && (
                    <Motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.26, ease: 'easeInOut' }}
                    >
                      <div
                        className="px-6 pb-6 text-slate-400 text-[14.5px] leading-relaxed border-t"
                        style={{ borderColor: 'rgba(255,255,255,0.05)', paddingTop: '16px' }}
                      >
                        {faq.a}
                      </div>
                    </Motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
