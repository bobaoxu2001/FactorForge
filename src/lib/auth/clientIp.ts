/**
 * Best-effort client IP extraction for rate-limit bucketing.
 *
 * `x-forwarded-for` is a comma-separated list appended by each proxy hop; the
 * left-most entry is the originating client. We trust it for *throttling only* —
 * a spoofed value merely changes which bucket an attacker fills and never grants
 * access — so best-effort parsing is acceptable. Falls back to `x-real-ip`.
 *
 * Returns null when no proxy header is present (e.g. local dev with no
 * upstream proxy). Callers should fail open and skip the per-IP limit in that
 * case rather than funnel every request into a single shared bucket.
 */
export function clientIpFromHeaders(
  forwardedFor: string | null | undefined,
  realIp?: string | null,
): string | null {
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = realIp?.trim();
  return real ? real : null;
}
