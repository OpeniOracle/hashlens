/** @type {import('tailwindcss').Config} */
// Openi design language via the shared kernel preset. HashLens keeps its
// semantic color names (bg/border/brand/muted) so component classes are
// stable, but every value now comes from @openi/kernel/tokens — brand is the
// suite's amber signal (was app-local sky blue).
import openi from '@openi/kernel/tailwind-preset';
import { palette } from '@openi/kernel/tokens';

export default {
  darkMode: 'class',
  presets: [openi],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: palette.navy[950],
          raised: palette.navy[900],
          // One step below the navy ramp for inset wells.
          inset: '#070c16',
        },
        border: {
          DEFAULT: palette.navy[700],
          subtle: palette.navy[800],
        },
        // ADR-004: brand-interactive color is the suite ACTION blue; amber is
        // reserved for attention states (warn/signal semantics).
        brand: {
          DEFAULT: palette.action.DEFAULT,
          fg: '#ffffff',
          muted: palette.action.muted,
        },
        muted: palette.bone[500],
      },
    },
  },
  plugins: [],
};
