/** @type {import('tailwindcss').Config} */

/**
 * Design tokens for the LMS.
 *
 * One primary (royal blue) carries every action, active state and progress
 * indicator. Everything else is neutral, with green / amber / red reserved
 * strictly for success / warning / error semantics.
 */
const primary = {
  50: '#eff5ff',
  100: '#dbe8fe',
  200: '#bfd6fe',
  300: '#93b8fd',
  400: '#6092fa',
  500: '#3b6df6',
  600: '#2450eb',
  700: '#1d3ed8',
  800: '#1e35af',
  900: '#1e328a',
  950: '#172054',
};

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1.25rem', sm: '1.5rem', lg: '2rem' },
      screens: { '2xl': '1200px' },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary,
        // `brand` is kept as an alias so pre-existing markup keeps working.
        brand: primary,
        // Dark navy used for headings and the darkest surfaces.
        ink: {
          50: '#f5f7fa',
          100: '#e9edf4',
          200: '#cfd8e6',
          300: '#a6b6ce',
          400: '#7690b1',
          500: '#547096',
          600: '#41597c',
          700: '#364865',
          800: '#2f3e55',
          900: '#0f1b33',
          950: '#080f1e',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f7f9fc',
          sunken: '#eef2f8',
        },
      },
      fontSize: {
        // Tightened tracking on display sizes keeps large headings premium.
        'display-sm': ['2rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        display: ['2.5rem', { lineHeight: '1.15', letterSpacing: '-0.025em' }],
        'display-lg': ['3.25rem', { lineHeight: '1.08', letterSpacing: '-0.03em' }],
      },
      borderRadius: {
        card: '0.875rem',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(15,27,51,.06)',
        card: '0 1px 2px rgba(15,27,51,.05), 0 1px 3px rgba(15,27,51,.04)',
        'card-hover': '0 4px 6px -2px rgba(15,27,51,.05), 0 12px 24px -8px rgba(15,27,51,.14)',
        pop: '0 8px 12px -4px rgba(15,27,51,.08), 0 24px 48px -12px rgba(15,27,51,.18)',
        focus: '0 0 0 3px rgba(36,80,235,.18)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(.22,1,.36,1)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'none' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up .5s cubic-bezier(.22,1,.36,1) both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};
