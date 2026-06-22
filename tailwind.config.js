/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark, professional "Openi" palette.
        bg: {
          DEFAULT: '#0b0f17',
          raised: '#111722',
          inset: '#0a0e15',
        },
        border: {
          DEFAULT: '#1f2937',
          subtle: '#161e2b',
        },
        brand: {
          DEFAULT: '#38bdf8',
          fg: '#0b0f17',
          muted: '#0e7490',
        },
        danger: '#f87171',
        warn: '#fbbf24',
        ok: '#34d399',
        muted: '#7c8aa0',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
