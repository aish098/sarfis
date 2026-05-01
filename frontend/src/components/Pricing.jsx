import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Check, Zap } from 'lucide-react';

const plans = [
  {
    name: 'Starter',
    monthlyPrice: '$0',
    yearlyPrice: '$0',
    desc: 'For individuals and small projects',
    features: ['Limited reports', '1 User', 'Basic Ledger', 'Community Support'],
    cta: 'Get Started Free',
    href: '/register',
    highlight: false,
  },
  {
    name: 'Basic',
    monthlyPrice: '$29',
    yearlyPrice: '$23',
    desc: 'For growing teams and businesses',
    features: ['Full accounting suite', 'Up to 5 Users', 'Standard Email Support', 'Data Export'],
    cta: 'Start Basic',
    href: '/register',
    highlight: false,
  },
  {
    name: 'Pro',
    monthlyPrice: '$99',
    yearlyPrice: '$79',
    desc: 'For established businesses and enterprises',
    features: ['Advanced Analytics + AI', 'Unlimited Users', 'Priority Phone & Email Support', 'API Access & Integrations'],
    cta: 'Start Pro Trial',
    href: '/register',
    highlight: true,
  },
];

export default function Pricing() {
  const [yearly, setYearly] = useState(false);

  return (
    <section
      id="pricing"
      className="py-28 px-5 sm:px-8 relative overflow-hidden"
      style={{ background: '#030b1a' }}
    >
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.15), transparent)' }} />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold mb-6"
            style={{ background: 'rgba(16,185,129,0.07)', borderColor: 'rgba(16,185,129,0.22)', color: '#6ee7b7' }}
          >
            Pricing
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4"
            style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}
          >
            Straightforward Pricing
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="text-slate-400 text-lg mb-8"
          >
            Choose the plan that's right for your business. No hidden fees, ever.
          </motion.p>

          {/* Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: 0.2 }}
            className="inline-flex items-center gap-3 p-1 rounded-xl border"
            style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <button
              onClick={() => setYearly(false)}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all duration-250 ${
                !yearly ? 'text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
              style={!yearly ? { background: 'rgba(255,255,255,0.08)' } : {}}
            >
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all duration-250 flex items-center gap-2 ${
                yearly ? 'text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
              style={yearly ? { background: 'rgba(255,255,255,0.08)' } : {}}
            >
              Yearly
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(16,185,129,0.15)', color: '#6ee7b7' }}
              >
                Save 20%
              </span>
            </button>
          </motion.div>
        </div>

        {/* Cards */}
        <div className="grid lg:grid-cols-3 gap-6 items-center">
          {plans.map((plan, i) => (
            <PricingCard key={i} plan={plan} yearly={yearly} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingCard({ plan, yearly, index }) {
  const price = yearly ? plan.yearlyPrice : plan.monthlyPrice;

  return (
    <motion.div
      initial={{ opacity: 0, y: 32, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      whileHover={!plan.highlight ? { y: -6, scale: 1.02 } : { scale: 1.02 }}
      className={`relative flex flex-col p-8 rounded-2xl border transition-all duration-300 ${
        plan.highlight ? 'lg:scale-105' : ''
      }`}
      style={
        plan.highlight
          ? {
              background: 'linear-gradient(160deg, #0a2218 0%, #061820 100%)',
              borderColor: 'rgba(16,185,129,0.35)',
              boxShadow: '0 0 0 1px rgba(16,185,129,0.2), 0 20px 60px rgba(16,185,129,0.12), 0 4px 16px rgba(0,0,0,0.4)',
            }
          : {
              background: 'rgba(255,255,255,0.025)',
              borderColor: 'rgba(255,255,255,0.07)',
            }
      }
    >
      {/* Glow for Pro */}
      {plan.highlight && (
        <>
          <div
            className="absolute -inset-1 rounded-2xl pointer-events-none opacity-30"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.4), transparent 70%)', filter: 'blur(12px)' }}
          />
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1.5 rounded-full text-[11px] font-black tracking-wide"
            style={{
              background: 'linear-gradient(135deg, #059669, #0891b2)',
              color: 'white',
              boxShadow: '0 4px 16px rgba(16,185,129,0.4)',
            }}
          >
            MOST POPULAR
          </div>
        </>
      )}

      <div className="flex-grow relative z-10">
        <h3
          className="text-xl font-bold text-white mb-1"
          style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}
        >
          {plan.name}
        </h3>
        <p className="text-slate-500 text-sm mb-6">{plan.desc}</p>

        <div className="flex items-end gap-1 mb-8">
          <motion.span
            key={price}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="text-5xl font-black text-white leading-none"
            style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}
          >
            {price}
          </motion.span>
          <span className="text-slate-500 text-base mb-1">/mo</span>
        </div>

        <ul className="space-y-3.5 mb-8">
          {plan.features.map((feature, j) => (
            <li key={j} className="flex items-start gap-3">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: plan.highlight ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.07)' }}
              >
                <Check size={11} className={plan.highlight ? 'text-emerald-400' : 'text-slate-400'} />
              </div>
              <span className={`text-sm ${plan.highlight ? 'text-slate-300' : 'text-slate-400'}`}>
                {feature}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
        <Link
          to={plan.href}
          className={`w-full text-center block px-6 py-3.5 rounded-xl text-sm font-semibold transition-all duration-250 relative overflow-hidden group ${
            plan.highlight ? 'text-white' : 'text-white'
          }`}
          style={
            plan.highlight
              ? { background: 'linear-gradient(135deg, #059669, #0891b2)' }
              : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }
          }
        >
          {plan.highlight && (
            <span
              className="absolute -inset-1 opacity-0 group-hover:opacity-50 transition-opacity duration-400 blur-lg"
              style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}
            />
          )}
          <span className="relative z-10 flex items-center justify-center gap-1.5">
            {plan.highlight && <Zap size={13} className="fill-white" />}
            {plan.cta}
          </span>
        </Link>
      </motion.div>
    </motion.div>
  );
}
