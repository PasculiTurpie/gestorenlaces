/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        noc: {
          bg: '#090d12',
          panel: '#101720',
          raised: '#162030',
          line: '#223043',
          'line-strong': '#33465c',
          text: '#d9e3ee',
          muted: '#8296ab',
          focus: '#7dd3fc',
        },
        estado: { ok: '#22c55e', deg: '#f97316', down: '#ef4444', mant: '#3b82f6' },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Condensed"', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
