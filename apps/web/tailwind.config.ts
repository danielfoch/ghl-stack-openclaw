import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0f172a",
        surface: "#111827",
        accent: "#22c55e",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
