import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#020812",
        panel: "#07111d",
        panel2: "#0b1624",
        ink: { DEFAULT: "#eef4ff", muted: "#a8b3c5", soft: "#69778d" },
        line: "rgba(120, 149, 184, 0.20)",
        brand: { red: "#fb7185", green: "#34d399", blue: "#60a5fa", cyan: "#22d3ee", amber: "#fbbf24", purple: "#a78bfa" },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Inter", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.06), 0 22px 70px -54px rgba(59,130,246,0.70)",
        cardHover: "0 22px 58px -34px rgba(59,130,246,0.52), 0 1px 0 rgba(255,255,255,0.10)",
      },
      borderRadius: { xl2: "14px" },
    },
  },
  plugins: [],
};
export default config;
