import { createHash } from "node:crypto";

/**
 * Append-only records with a hash chain.
 *
 * Each record's hash covers its own content plus the previous record's hash,
 * so editing an old forecast or thesis (or deleting one) breaks every hash
 * after it. The test suite verifies the committed ledgers on every run: a
 * changed prediction cannot slip through review as an innocent-looking diff.
 * Corrections are new records that point at the old one, never edits.
 */

export const GENESIS = "0".repeat(64);

/** JSON with sorted keys, so the hash does not depend on property order. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export function hashRecord<T extends { hash?: string; prevHash?: string }>(record: T, prevHash: string): string {
  const { hash: _hash, prevHash: _prev, ...content } = record;
  void _hash;
  void _prev;
  return createHash("sha256").update(prevHash).update(canonicalJson(content)).digest("hex");
}

export function appendRecord<T extends object>(ledger: Array<T & { hash: string; prevHash: string }>, record: T): T & { hash: string; prevHash: string } {
  const prevHash = ledger.at(-1)?.hash ?? GENESIS;
  return { ...record, prevHash, hash: hashRecord(record as T & { hash?: string; prevHash?: string }, prevHash) };
}

export interface ChainCheck {
  ok: boolean;
  checked: number;
  brokenAt: number | null;
  message: string;
}

export function verifyChain(ledger: Array<{ hash: string; prevHash: string; id?: string }>): ChainCheck {
  let prev = GENESIS;
  for (let i = 0; i < ledger.length; i++) {
    const rec = ledger[i];
    if (rec.prevHash !== prev) {
      return { ok: false, checked: i, brokenAt: i, message: `Record ${rec.id ?? i} points at the wrong predecessor (a record was removed or reordered).` };
    }
    const expected = hashRecord(rec, prev);
    if (expected !== rec.hash) {
      return { ok: false, checked: i, brokenAt: i, message: `Record ${rec.id ?? i} was edited after it was written.` };
    }
    prev = rec.hash;
  }
  return { ok: true, checked: ledger.length, brokenAt: null, message: `${ledger.length} records, chain intact.` };
}
