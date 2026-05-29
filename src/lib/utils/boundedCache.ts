/**
 * Insert into a Map with a hard size cap, evicting the oldest entry (FIFO) when
 * full. JS Map preserves insertion order, so the first key returned by the
 * iterator is the oldest. Use for module-level memo caches that would otherwise
 * grow without bound across the process lifetime.
 *
 * Re-setting an existing key refreshes its value but, by design, does NOT move
 * it to the newest slot — these caches are keyed by content (date/fingerprint),
 * so a repeat key means "same input", not "recently used".
 */
export function boundedSet<K, V>(map: Map<K, V>, key: K, value: V, maxSize: number): void {
  if (!map.has(key) && map.size >= maxSize) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, value);
}
