import { NextResponse } from "next/server";
import { validateEnv } from "@/lib/config/env";
import { getDb } from "@/lib/persistence/db";
import { rateLimitBackend } from "@/lib/ratelimit";

// Liveness/readiness probe for load balancers, container orchestrators, and
// uptime monitors. Never cached — it must reflect the live process.
export const dynamic = "force-dynamic";

const APP_VERSION = process.env.npm_package_version ?? "0.1.0";
const startedAt = Date.now();

export async function GET() {
  const env = validateEnv();
  const dbUp = getDb() !== null;

  // Degraded (still serving) vs unhealthy: a missing DB means watchlists/cache
  // are down but the research pipeline still renders, so report 200/degraded.
  // Production env errors are a hard 503 — the process should not take traffic.
  const status = !env.ok ? "unhealthy" : dbUp ? "ok" : "degraded";
  const httpStatus = status === "unhealthy" ? 503 : 200;

  return NextResponse.json(
    {
      status,
      version: APP_VERSION,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
      checks: {
        database: dbUp ? "up" : "down",
        sessionConfigured: env.features.sessionConfigured,
        rateLimitBackend: rateLimitBackend(),
      },
      features: env.features,
      warnings: env.warnings,
      errors: env.errors,
    },
    { status: httpStatus, headers: { "cache-control": "no-store" } },
  );
}
