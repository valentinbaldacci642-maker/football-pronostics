/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          50: '#f0f4ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          900: '#0a0e1a',
          800: '#0f1629',
          700: '#151e38',
          600: '#1a2540',
          500: '#1e2d4d',
        },
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        gold: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        danger: '#ef4444',
        warning: '#f97316',
        info: '#3b82f6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'live-dot': 'liveDot 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        liveDot: { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.2 } },
      },
      backgroundImage: {
        'card-gradient': 'linear-gradient(135deg, #0f1629 0%, #151e38 100%)',
        'brand-gradient': 'linear-gradient(135deg, #059669 0%, #047857 100%)',
        'gold-gradient': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        'danger-gradient': 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      },
      boxShadow: {
        card: '0 4px 24px rgba(0, 0, 0, 0.4)',
        glow: '0 0 20px rgba(16, 185, 129, 0.25)',
        'gold-glow': '0 0 20px rgba(245, 158, 11, 0.25)',
      },
    },
  },
  plugins: [],
};
