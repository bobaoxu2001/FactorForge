import type { Config } from "tailwindcss";

/**
 * "Research note" palette: white paper, blue-black printer's ink, hairline rules,
 * one research blue for interaction, and a highlighter reserved for key findings.
 * Colour otherwise only carries meaning (up/down, supports/contradicts).
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Canvas behind the page, the page itself, and a faint inset surface.
        bg: "#eef0f3",
        paper: "#ffffff",
        panel: "#ffffff",
        panel2: "#f6f7f9",
        ink: { DEFAULT: "#18202c", muted: "#475162", soft: "#677184" },
        line: "#dde1e7",
        accent: { DEFAULT: "#1d4f91", soft: "#e8eef7" },
        highlight: "#ffe27a",
        brand: { red: "#b42318", green: "#17794a", blue: "#1d4f91", cyan: "#0e6f86", amber: "#a15c07", purple: "#5b3fa3" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(24, 32, 44, 0.03)",
        cardHover: "0 1px 0 rgba(24, 32, 44, 0.05), 0 6px 18px -12px rgba(24, 32, 44, 0.25)",
      },
      borderRadius: { xl2: "8px" },
    },
  },
  plugins: [],
};
export default config;
