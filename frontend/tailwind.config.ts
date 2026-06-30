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
        royal: {
          DEFAULT: "#003087",
          50: "#F0F4FB",
          100: "#E1E9F7",
          200: "#C3D3EF",
          300: "#A5BDE7",
          400: "#6B92D4",
          500: "#3167C1",
          600: "#1A4BA0",
          700: "#003087",
          800: "#002266",
          900: "#001433",
        },
        rag: {
          green: "#16A34A",
          amber: "#D97706",
          red: "#DC2626",
        },
      },
    },
  },
  plugins: [],
};
export default config;
