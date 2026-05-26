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
        brand: { red: "#ff5c4d", green: "#34d399", blue: "#3b82f6", amber: "#f59e0b", purple: "#a855f7" },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Inter", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.04), 0 18px 60px -48px rgba(59,130,246,0.55)",
        cardHover: "0 16px 42px -28px rgba(59,130,246,0.45), 0 1px 0 rgba(255,255,255,0.08)",
      },
      borderRadius: { xl2: "14px" },
    },
  },
  plugins: [],
};
export default config;
