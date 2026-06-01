/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

// Content-Security-Policy. Kept tight (default-src 'self') with the minimum
// relaxations Next.js + Tailwind/Recharts need:
//  - 'unsafe-inline' on style/script: Next injects an inline hydration bootstrap
//    and Tailwind/Recharts emit inline styles. Nonce-based CSP would need
//    middleware; that's the documented next step.
//  - 'unsafe-eval' + ws: only in dev, for React Fast Refresh / HMR.
// All real-data + LLM calls happen server-side, so connect-src stays 'self'.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  // Browsers POST violation reports here; the route logs them via the structured
  // logger. report-uri is widely supported; report-to is the newer successor.
  "report-uri /api/csp-report",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // Only meaningful over HTTPS; harmless on http and correct once deployed behind TLS.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for small, reproducible container images.
  output: "standalone",
  poweredByHeader: false,
  // better-sqlite3 is a native addon. If Next bundles it, the .node binding
  // fails to load at runtime and the whole persistence layer (cache, auth,
  // watchlists) silently degrades to "unavailable". Keep it external so the
  // real require() resolves the prebuilt binary.
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
