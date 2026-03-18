import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        navy: {
          DEFAULT: "#0F2647",
          50: "#E8EEF4",
          100: "#D1DDE9",
          200: "#A3BBD3",
          300: "#7599BD",
          400: "#4777A7",
          500: "#0F2647",
          600: "#0C1E39",
          700: "#09172B",
          800: "#060F1D",
          900: "#03080E",
        },
        rag: {
          green: "#16A34A",
          amber: "#F59E0B",
          red: "#DC2626",
        },
      },
    },
  },
  plugins: [],
};
export default config;
