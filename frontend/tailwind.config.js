/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Sora', 'DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      colors: {
        navy: {
          950: '#04091a',
          900: '#060d24',
          800: '#0b1535',
          700: '#0f1e4a',
          600: '#172554',
        },
        surface: {
          DEFAULT: '#ffffff',
          2: '#f8fafc',
          3: '#f1f5f9',
        },
        emerald: {
          DEFAULT: '#059669',
          light: '#d1fae5',
          mid: '#10b981',
          dark: '#047857',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-md': '0 4px 16px rgba(0,0,0,0.07), 0 2px 6px rgba(0,0,0,0.05)',
        'card-lg': '0 12px 32px rgba(0,0,0,0.09), 0 4px 12px rgba(0,0,0,0.06)',
        'card-xl': '0 24px 64px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08)',
        glow: '0 0 24px rgba(16, 185, 129, 0.3)',
        'glow-sm': '0 0 12px rgba(16, 185, 129, 0.2)',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
      },
      animation: {
        'fade-up': 'fadeUp 0.45s ease-out forwards',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        float: 'float 4s ease-in-out infinite',
        shimmer: 'skeleton-shimmer 1.4s infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
