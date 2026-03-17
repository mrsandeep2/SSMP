import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],

  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {

    container: {
      center: true,
      padding: "2rem",
    },

    extend: {

      fontFamily: {
        sans: ["Inter", "sans-serif"],
        display: ["Space Grotesk", "sans-serif"],
      },

      colors: {

        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },

        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },

        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },

        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

      },

      animation: {
        float: "floatSmooth 6s ease-in-out infinite",
        glow: "glowPulse 2s ease-in-out infinite alternate",
      },

      keyframes: {

        glowPulse: {
          "0%": {
            boxShadow: "0 0 10px rgba(124,58,237,0.4)"
          },

          "100%": {
            boxShadow: "0 0 30px rgba(124,58,237,0.9)"
          },

        },

        floatSmooth: {
          "0%,100%": {
            transform: "translateY(0px)"
          },

          "50%": {
            transform: "translateY(-12px)"
          },

        },

      },

    },

  },

  plugins: [],

} satisfies Config;
