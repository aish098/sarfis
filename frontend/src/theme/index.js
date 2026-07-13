export const COLORS = {
  primary: '#10b981',      // emerald-500
  primaryHover: '#059669',  // emerald-600
  secondary: '#06b6d4',    // cyan-500
  secondaryHover: '#0891b2',// cyan-600
  accent: '#6366f1',       // indigo-500
  accentHover: '#4f46e5',  // indigo-600
  
  // Status Colors
  success: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-100'
  },
  pending: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-100'
  },
  active: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-100'
  },
  warning: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-100'
  },
  danger: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-100'
  },
  closed: {
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    border: 'border-slate-200'
  }
};

export const SPACING = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  xxl: '3rem'      // 48px
};

export const TYPOGRAPHY = {
  fontSans: "'DM Sans', system-ui, sans-serif",
  fontDisplay: "'Sora', 'DM Sans', system-ui, sans-serif",
  fontMono: "'JetBrains Mono', monospace",
  
  sizes: {
    xs: '11px',
    sm: '12.5px',
    base: '14px',
    lg: '16px',
    xl: '18px',
    xxl: '22px'
  }
};

export const RADIUS = {
  sm: '0.375rem',  // 6px
  md: '0.5rem',    // 8px
  lg: '0.75rem',   // 12px
  xl: '1rem',      // 16px
  xxl: '1.5rem',   // 24px
  max: '9999px'
};

export const SHADOWS = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
};

export const ANIMATION = {
  fast: 150,   // ms
  normal: 200, // ms
  slow: 300    // ms
};
