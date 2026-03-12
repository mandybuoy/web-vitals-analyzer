/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Instrument Sans", "Arial", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      lineHeight: {
        brand: "150%",
      },
      colors: {
        vecton: {
          orange: "#FF5631",
          purple: "#7E43BA",
          light: "#F9FAF6",
          dark: "#24140D",
          beige: "#E8E9D7",
        },
        vital: {
          good: "#0cce6b",
          needs: "#ffa400",
          poor: "#ff4e42",
        },
      },
      animation: {
        "fade-up": "fadeUp 0.6s ease-out forwards",
        "slide-in": "slideIn 0.3s ease-out forwards",
        "slide-out": "slideOut 0.3s ease-in forwards",
        "progress-pulse": "progressPulse 1.5s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        slideOut: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(100%)" },
        },
        progressPulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
    },
  },
  plugins: [],
};
