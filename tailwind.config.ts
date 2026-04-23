import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0a0a",
        bone: "#fafafa",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["\"Archivo Black\"", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        "zebra-slide": {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "56px 0" },
        },
        "stripe-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.65" },
        },
      },
      animation: {
        "zebra-slide": "zebra-slide 1.4s linear infinite",
        "stripe-pulse": "stripe-pulse 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
