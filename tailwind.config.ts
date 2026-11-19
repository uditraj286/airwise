import type { Config } from "tailwindcss";

/** Design tokens mirror the reference dashboard: soft grey canvas, white cards, deep green brand. */
const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        subtle: "rgb(var(--subtle) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        brand: "rgb(var(--brand) / <alpha-value>)",
        "brand-strong": "rgb(var(--brand-strong) / <alpha-value>)",
        "brand-soft": "rgb(var(--brand-soft) / <alpha-value>)",
        panel: "rgb(var(--panel) / <alpha-value>)",
        onbrand: "rgb(var(--on-brand) / <alpha-value>)",
        good: "rgb(var(--good) / <alpha-value>)",
        warn: "rgb(var(--warn) / <alpha-value>)",
        bad: "rgb(var(--bad) / <alpha-value>)",
        amber: "rgb(var(--amber) / <alpha-value>)",
        aqi: {
          good: "rgb(var(--aqi-good) / <alpha-value>)",
          satisfactory: "rgb(var(--aqi-satisfactory) / <alpha-value>)",
          moderate: "rgb(var(--aqi-moderate) / <alpha-value>)",
          poor: "rgb(var(--aqi-poor) / <alpha-value>)",
          "very-poor": "rgb(var(--aqi-very-poor) / <alpha-value>)",
          severe: "rgb(var(--aqi-severe) / <alpha-value>)",
        },
      },
      fontSize: {
        display: ["2.75rem", { lineHeight: "1", letterSpacing: "-0.03em", fontWeight: "500" }],
        title: ["1.125rem", { lineHeight: "1.4", letterSpacing: "-0.01em", fontWeight: "500" }],
        label: ["0.875rem", { lineHeight: "1.25rem" }],
        caption: ["0.75rem", { lineHeight: "1rem" }],
      },
      transitionTimingFunction: { standard: "cubic-bezier(0.2, 0, 0, 1)" },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      borderRadius: { card: "24px" },
      boxShadow: { card: "0 1px 2px rgb(0 0 0 / 0.04), 0 0 0 1px rgb(var(--line) / 1)" },
    },
  },
  plugins: [],
};
export default config;
