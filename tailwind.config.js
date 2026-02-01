/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Instrument Sans', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      lineHeight: {
        brand: '110%',
      },
      colors: {
        vecton: {
          orange: '#FF5631',
          purple: '#7E43BA',
          light: '#F9FAF6',
          dark: '#24140D',
          beige: '#E8E9D7',
        },
        vital: {
          good: '#0cce6b',
          needs: '#ffa400',
          poor: '#ff4e42',
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.6s ease-out forwards',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
