/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        gold: "#F0B90B",
        "gold-dark": "#C99A00",
        "dark-bg": "#000000",
        "dark-card": "#0a0e1a",
        "dark-border": "rgba(240,185,11,0.15)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
