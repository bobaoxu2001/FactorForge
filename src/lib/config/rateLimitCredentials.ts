type EnvLike = Record<string, string | undefined>;

/** Select a complete provider pair. Partial Upstash and KV values must never be combined. */
export function getRateLimitCredentials(env: EnvLike): { url: string; token: string } | null {
  for (const [urlValue, tokenValue] of [
    [env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN],
    [env.KV_REST_API_URL, env.KV_REST_API_TOKEN],
  ]) {
    const url = urlValue?.trim();
    const token = tokenValue?.trim();
    if (url && token) return { url, token };
  }
  return null;
}
