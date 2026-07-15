import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Quote, ChevronLeft, ChevronRight } from 'lucide-react';

const testimonials = [
  {
    name: 'Bob Parsons',
    role: 'CEO, TechFlow',
    avatar: 'B',
    review: 'ACCOUNTELLENCE completely transformed how we handle our accounting. The AI predictions are incredibly accurate and have saved us significant planning time every quarter.',
    rating: 5,
    color: '#10b981',
  },
  {
    name: 'Tony Fernandes',
    role: 'CFO, GlobalTrade',
    avatar: 'T',
    review: 'The automated ledger posting saved our team hundreds of hours each month. The budget variance alerts caught a $40K discrepancy we would have missed. Exceptional.',
    rating: 5,
    color: '#06b6d4',
  },
  {
    name: 'Sarah Chen',
    role: 'Finance Director, NovaCorp',
    avatar: 'S',
    review: 'We switched from QuickBooks to ACCOUNTELLENCE last year and the difference is night and day. The AI forecasting alone paid for the subscription within two months.',
    rating: 5,
    color: '#8b5cf6',
  },
];

const stats = [
  { value: '4.9/5', label: 'Average rating' },
  { value: '500+', label: 'Businesses served' },
  { value: '98%', label: 'Customer retention' },
];

export default function Testimonials() {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    const timer = setInterval(() => {
      setDirection(1);
      setCurrent((c) => (c + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const navigate = (dir) => {
    setDirection(dir);
    setCurrent((c) => (c + dir + testimonials.length) % testimonials.length);
  };

  const variants = {
    enter: (dir) => ({ opacity: 0, x: dir > 0 ? 48 : -48 }),
    center: { opacity: 1, x: 0 },
    exit: (dir) => ({ opacity: 0, x: dir > 0 ? -48 : 48 }),
  };

  return (
    <section
      className="py-28 px-5 sm:px-8 relative overflow-hidden"
      style={{ background: '#040e1f' }}
    >
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.15), transparent)' }} />

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold mb-6"
            style={{ background: 'rgba(16,185,129,0.07)', borderColor: 'rgba(16,185,129,0.22)', color: '#6ee7b7' }}
          >
            Customer Stories
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4"
            style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}
          >
            What Our Customers Say
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="text-slate-400 text-lg"
          >
            Real stories from businesses revolutionizing their finances with ACCOUNTELLENCE.
          </motion.p>
        </div>

        {/* Carousel */}
        <div className="relative mb-16">
          <div className="overflow-hidden">
            <AnimatePresence custom={direction} mode="wait">
              <motion.div
                key={current}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              >
                <TestimonialCard testimonial={testimonials[current]} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Arrows */}
          <button
            onClick={() => navigate(-1)}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 lg:-translate-x-8 w-10 h-10 rounded-xl border flex items-center justify-center text-slate-400 hover:text-white transition-all duration-200 hidden sm:flex"
            style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => navigate(1)}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 lg:translate-x-8 w-10 h-10 rounded-xl border flex items-center justify-center text-slate-400 hover:text-white transition-all duration-200 hidden sm:flex"
            style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mb-20">
          {testimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => { setDirection(i > current ? 1 : -1); setCurrent(i); }}
              className="transition-all duration-300 rounded-full"
              style={{
                width: i === current ? 24 : 6,
                height: 6,
                background: i === current ? '#10b981' : 'rgba(255,255,255,0.15)',
              }}
            />
          ))}
        </div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="grid grid-cols-3 gap-0 rounded-2xl border overflow-hidden"
          style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
        >
          {stats.map((s, i) => (
            <div
              key={i}
              className={`py-7 text-center ${i < stats.length - 1 ? 'border-r' : ''}`}
              style={{ borderColor: 'rgba(255,255,255,0.07)' }}
            >
              <div
                className="text-3xl font-black text-white mb-1"
                style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}
              >
                {s.value}
              </div>
              <div className="text-slate-500 text-sm">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function TestimonialCard({ testimonial }) {
  return (
    <div
      className="mx-auto max-w-3xl p-10 rounded-2xl border relative overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.025)',
        borderColor: 'rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Background quote icon */}
      <Quote
        size={64}
        className="absolute top-6 right-8 opacity-[0.04] text-white"
        style={{ transform: 'rotate(180deg)' }}
      />

      {/* Stars */}
      <div className="flex gap-1 mb-6">
        {Array.from({ length: testimonial.rating }).map((_, i) => (
          <Star key={i} size={16} className="text-amber-400 fill-amber-400" />
        ))}
      </div>

      {/* Quote */}
      <p className="text-white text-lg leading-relaxed mb-8 font-medium">
        "{testimonial.review}"
      </p>

      {/* Author */}
      <div className="flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold border"
          style={{
            background: `${testimonial.color}18`,
            borderColor: `${testimonial.color}40`,
            color: testimonial.color,
            fontFamily: "'Sora', system-ui, sans-serif",
          }}
        >
          {testimonial.avatar}
        </div>
        <div>
          <div
            className="font-bold text-white text-[15px]"
            style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif" }}
          >
            {testimonial.name}
          </div>
          <div className="text-sm font-medium" style={{ color: testimonial.color }}>
            {testimonial.role}
          </div>
        </div>
      </div>
    </div>
  );
}
