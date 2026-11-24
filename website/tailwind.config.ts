import type { Config } from 'tailwindcss';
import { colors, fontFamily } from './src/styles/tokens';

// Same theme the prototype passed to the Tailwind Play CDN (v3.4.17), now compiled at build time.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors,
      fontFamily,
      transitionTimingFunction: { lumi: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    },
  },
};

export default config;
