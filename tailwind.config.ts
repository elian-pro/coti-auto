import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1.5rem",
        md: "2.5rem",
        lg: "5rem",
      },
      screens: { sm: "640px", md: "768px", lg: "1024px", xl: "1280px" },
    },
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0A0A0A",
          900: "#0F172A",
          700: "#262626",
          500: "#737373",
          400: "#94A3B8",
          300: "#CBD5E1",
          200: "#E5E5E5",
          100: "#F5F7FA",
          50: "#F9FAFB",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      fontSize: {
        display: [
          "clamp(2.5rem, calc(1rem + 5vw), 4.5rem)",
          { lineHeight: "1.05", letterSpacing: "-0.03em" },
        ],
        h1: [
          "clamp(2rem, calc(1rem + 3vw), 3rem)",
          { lineHeight: "1.1", letterSpacing: "-0.02em" },
        ],
        h2: [
          "clamp(1.5rem, calc(1rem + 1.5vw), 2rem)",
          { lineHeight: "1.2", letterSpacing: "-0.01em" },
        ],
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "10px",
        xl: "10px",
        "2xl": "12px",
        "3xl": "12px",
      },
      boxShadow: {
        sm: "0 0 0 1px rgba(10,10,10,.04), 0 1px 2px rgba(10,10,10,.06)",
        md: "0 0 0 1px rgba(10,10,10,.04), 0 2px 4px -1px rgba(10,10,10,.08), 0 4px 8px -2px rgba(10,10,10,.06)",
        lg: "0 0 0 1px rgba(10,10,10,.04), 0 4px 8px -2px rgba(10,10,10,.10), 0 12px 24px -6px rgba(10,10,10,.10)",
        xl: "0 0 0 1px rgba(10,10,10,.04), 0 8px 16px -4px rgba(10,10,10,.12), 0 24px 48px -12px rgba(10,10,10,.14)",
        card: "0 0 0 1px rgba(10,10,10,.04), 0 1px 2px rgba(10,10,10,.06)",
        soft: "0 0 0 1px rgba(10,10,10,.04), 0 4px 8px -2px rgba(10,10,10,.10), 0 12px 24px -6px rgba(10,10,10,.10)",
      },
      transitionTimingFunction: {
        zebra: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
