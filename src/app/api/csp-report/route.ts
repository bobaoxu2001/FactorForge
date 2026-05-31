import { NextResponse } from "next/server";
import { createLogger } from "@/lib/observability/logger";

// Sink for Content-Security-Policy violation reports. The CSP `report-uri`
// directive (see next.config.js) points browsers here; on a blocked resource
// the browser POSTs a JSON report. We log it through the structured logger so
// violations land in the same JSON-line stream as everything else.
export const dynamic = "force-dynamic";

const log = createLogger("csp-report");

// Don't let a flood of reports (or a hostile client) spend unbounded time/memory.
const MAX_BODY_BYTES = 16 * 1024;

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return new NextResponse(null, { status: 413 });
    }
    let parsed: unknown = raw;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Keep the raw string if it isn't valid JSON.
    }
    // The classic format nests the detail under "csp-report".
    const report =
      parsed && typeof parsed === "object" && "csp-report" in parsed
        ? (parsed as Record<string, unknown>)["csp-report"]
        : parsed;
    log.warn("csp violation", { report });
  } catch (error) {
    log.warn("csp report parse failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  // 204: accepted, nothing to return. Browsers ignore the body anyway.
  return new NextResponse(null, { status: 204 });
}
