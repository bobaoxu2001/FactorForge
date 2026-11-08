import { countIndependent } from "./sources";
import { parseInstant, toIso } from "./time";
import type { Claim, ClaimView, EventRecord, EventView, Quantity, QuantityKind, SourceRecord, VerificationState } from "./types";

/**
 * Verification is derived, never typed in. Given the sources available at a
 * cutoff, each claim gets a state and the reason for it:
 *
 *   CONFIRMED     an official primary source says it first-hand; or the claim
 *                 is about the source's own conduct and the source says so
 *                 (a company describing what it did); or an original technical
 *                 report states its own finding; or it is read off market data.
 *   CORROBORATED  two or more independent origins (wire copies count once).
 *   REPORTED      one origin, or claims resting on unnamed sources.
 *   RUMOR         only aggregators or rewrites.
 *   DISPUTED      a source available at the cutoff contradicts it and no
 *                 official first-hand source settles it.
 *
 * Claims flagged `requiresOfficial` (attribution, enactment) top out at
 * CORROBORATED until an official source is read first-hand.
 */

const RANK: Record<VerificationState, number> = { DISPUTED: 0, RUMOR: 1, REPORTED: 2, CORROBORATED: 3, CONFIRMED: 4 };

export const availableAt = (source: SourceRecord) => parseInstant(source.publishedAt, `${source.id}.publishedAt`);

export function verifyClaim(claim: Claim, sources: SourceRecord[], asOfMs: number): ClaimView | null {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const usable = claim.citations
    .map((c) => ({ c, s: byId.get(c.sourceId) }))
    .filter((x): x is { c: typeof x.c; s: SourceRecord } => !!x.s && x.s.retrieval === "read" && availableAt(x.s) <= asOfMs);
  const supporting = usable.filter((x) => x.c.stance !== "contradicts");
  const contradicting = usable.filter((x) => x.c.stance === "contradicts");
  if (supporting.length === 0) return null; // not yet known at this cutoff

  const firstHand = supporting.filter((x) => !x.c.secondHand);
  const official = firstHand.some((x) => x.s.tier === "primary-official");
  const companyOwn = !!claim.aboutSourceOwnConduct && firstHand.some((x) => x.s.tier === "primary-company");
  const technical = firstHand.some((x) => x.s.tier === "primary-technical");
  const market = supporting.some((x) => x.s.tier === "market-data");
  const independent = countIndependent(supporting.map((x) => x.s), sources);
  const allUnattributed = supporting.every((x) => x.c.unattributed);
  const allAggregators = supporting.every((x) => x.s.tier === "secondary-aggregator");

  let state: VerificationState;
  let reason: string;
  if (contradicting.length > 0 && !official) {
    state = "DISPUTED";
    reason = `Contradicted by ${contradicting.map((x) => x.s.publisher).join(", ")}; no official first-hand source settles it.`;
  } else if (claim.requiresOfficial && !official) {
    state = independent >= 2 && !allUnattributed ? "CORROBORATED" : "REPORTED";
    reason = `Needs an official primary source, read first-hand; ${independent} independent origin(s) so far${supporting.some((x) => x.c.secondHand) ? ", including second-hand citation" : ""}.`;
  } else if (official || companyOwn || technical || market) {
    state = "CONFIRMED";
    reason = official
      ? "Stated first-hand by an official primary source."
      : market
        ? "Read directly from market data."
        : companyOwn
          ? "The company's own statement about its own conduct (an interested party; the substance is not independently verified)."
          : "Stated by the original technical report.";
  } else if (allAggregators) {
    state = "RUMOR";
    reason = "Only aggregators or rewrites carry it.";
  } else if (allUnattributed) {
    state = "REPORTED";
    reason = "Rests on unnamed sources.";
  } else if (independent >= 2) {
    state = "CORROBORATED";
    reason = `${independent} independent origins (copies of one story counted once).`;
  } else {
    state = "REPORTED";
    reason = "One origin so far.";
  }

  let effectiveLifecycle = claim.lifecycle;
  let lifecycleGuard: string | undefined;
  if (claim.lifecycle && ["ENACTED", "IMPLEMENTED", "REVISED"].includes(claim.lifecycle) && !official) {
    effectiveLifecycle = "PROPOSED";
    lifecycleGuard = `Marked ${claim.lifecycle}, but no official source confirms it first-hand; treated as proposed until one does.`;
  }

  return {
    ...claim,
    verification: state,
    verificationReason: reason,
    firstAvailableAt: toIso(Math.min(...supporting.map((x) => availableAt(x.s)))),
    independentSupport: independent,
    effectiveLifecycle,
    lifecycleGuard,
  };
}

/** The weakest state among a set (an event is only as verified as its weakest core claim). */
export const weakest = (states: VerificationState[]): VerificationState =>
  states.reduce((a, b) => (RANK[b] < RANK[a] ? b : a), "CONFIRMED" as VerificationState);

export const atLeast = (state: VerificationState, floor: VerificationState) => RANK[state] >= RANK[floor];

/**
 * The event as it could have been known at `asOf`: only sources published by
 * then, claims re-verified on those sources alone, and later claims hidden.
 * This is what forecasts and thesis revisions read, so they cannot see the future.
 */
export function eventAsOf(event: EventRecord, claims: Claim[], sources: SourceRecord[], asOf: string): EventView | null {
  const asOfMs = parseInstant(asOf, "asOf");
  if (parseInstant(event.occurredAt, `${event.id}.occurredAt`) > asOfMs) return null;
  const own = claims.filter((c) => c.eventId === event.id);
  const views = own.map((c) => verifyClaim(c, sources, asOfMs)).filter((v): v is ClaimView => v !== null);
  const core = views.filter((v) => event.coreClaimIds.includes(v.id));
  if (core.length === 0) return null;

  const cited = new Set(own.flatMap((c) => c.citations.map((x) => x.sourceId)));
  const visibleSources = sources.filter((s) => cited.has(s.id) && availableAt(s) <= asOfMs);
  const read = visibleSources.filter((s) => s.retrieval === "read");
  const verification = weakest(core.map((v) => v.verification));
  const coreIndependent = Math.max(...core.map((v) => v.independentSupport));
  const confidence: EventView["confidence"] =
    verification === "CONFIRMED" && coreIndependent >= 2 ? "high" : atLeast(verification, "CORROBORATED") ? "medium" : "low";
  const confidenceReason =
    confidence === "high"
      ? "Core facts confirmed and carried by at least two independent origins."
      : confidence === "medium"
        ? verification === "CONFIRMED"
          ? "Core facts confirmed, but by one origin (often the interested party)."
          : "Core facts corroborated by independent reporting but not confirmed first-hand."
        : "Core facts rest on a single report, unnamed sources or disputed accounts.";

  return {
    event,
    asOf,
    claims: views,
    // Versions of one article stay listed separately; independence is counted elsewhere.
    sources: [...visibleSources].sort((a, b) => availableAt(a) - availableAt(b)),
    verification,
    // First publication of the event itself: the earliest source behind a core claim (background sources do not count).
    firstPublishedAt: toIso(Math.min(...core.map((v) => parseInstant(v.firstAvailableAt)))),
    lastVerifiedAt: read.length ? toIso(Math.max(...read.map((s) => parseInstant(s.retrievedAt, `${s.id}.retrievedAt`)))) : null,
    confidence,
    confidenceReason,
    hiddenClaimCount: own.length - views.length,
  };
}

// ── Quantities ──────────────────────────────────────────────────────────────

export interface QuantityLine {
  kind: QuantityKind;
  latest: { claimId: string; quantity: Quantity; verification: VerificationState } | null;
  history: Array<{ claimId: string; quantity: Quantity; verification: VerificationState }>;
}

/**
 * Latest figure per kind, never mixing kinds. Frozen assets are not recovered
 * assets, and replenishment from the company's own funds is neither: each
 * stays on its own line, and a kind with no source stays empty (unknown),
 * not zero.
 */
export function quantityLedger(claims: ClaimView[], kinds: QuantityKind[]): QuantityLine[] {
  return kinds.map((kind) => {
    const history = claims
      .filter((c) => c.quantity?.kind === kind && c.verification !== "DISPUTED")
      .map((c) => ({ claimId: c.id, quantity: c.quantity!, verification: c.verification }))
      .sort((a, b) => parseInstant(a.quantity.asOf) - parseInstant(b.quantity.asOf));
    return { kind, latest: history.at(-1) ?? null, history };
  });
}

// ── Validation ──────────────────────────────────────────────────────────────

export interface ValidationIssue {
  level: "error" | "warning";
  where: string;
  message: string;
}

export function validateCase(events: EventRecord[], claims: Claim[], sources: SourceRecord[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const check = (where: string, fn: () => void) => {
    try {
      fn();
    } catch (error) {
      issues.push({ level: "error", where, message: error instanceof Error ? error.message : String(error) });
    }
  };
  const sourceIds = new Set<string>();
  for (const s of sources) {
    if (sourceIds.has(s.id)) issues.push({ level: "error", where: s.id, message: "duplicate source id" });
    sourceIds.add(s.id);
    check(`${s.id}.publishedAt`, () => parseInstant(s.publishedAt));
    check(`${s.id}.retrievedAt`, () => parseInstant(s.retrievedAt));
    if (!/^https:\/\//.test(s.url)) issues.push({ level: "error", where: s.id, message: "source URL must be https" });
    if (s.retrieval !== "read" && !s.retrievalNote) issues.push({ level: "error", where: s.id, message: "unread source needs a retrieval note" });
  }
  const claimIds = new Set<string>();
  const eventIds = new Set(events.map((e) => e.id));
  for (const c of claims) {
    if (claimIds.has(c.id)) issues.push({ level: "error", where: c.id, message: "duplicate claim id" });
    claimIds.add(c.id);
    if (!eventIds.has(c.eventId)) issues.push({ level: "error", where: c.id, message: `unknown event ${c.eventId}` });
    check(`${c.id}.recordedAt`, () => parseInstant(c.recordedAt));
    if (c.quantity) check(`${c.id}.quantity.asOf`, () => parseInstant(c.quantity!.asOf));
    if (c.citations.length === 0 && c.epistemic !== "UNKNOWN") issues.push({ level: "error", where: c.id, message: "claim has no citation" });
    for (const cit of c.citations) if (!sourceIds.has(cit.sourceId)) issues.push({ level: "error", where: c.id, message: `unknown source ${cit.sourceId}` });
  }
  for (const e of events) {
    check(`${e.id}.occurredAt`, () => parseInstant(e.occurredAt));
    for (const id of e.coreClaimIds) if (!claimIds.has(id)) issues.push({ level: "error", where: e.id, message: `unknown core claim ${id}` });
    for (const t of e.timeline) {
      check(`${e.id}.timeline`, () => parseInstant(t.at));
      for (const id of t.claimIds) if (!claimIds.has(id)) issues.push({ level: "error", where: e.id, message: `timeline cites unknown claim ${id}` });
    }
    for (const x of e.competingExplanations) {
      if (x.epistemic === "OBSERVED_FACT") issues.push({ level: "error", where: `${e.id}.${x.id}`, message: "an explanation of a move is never an observed fact" });
    }
  }
  return issues;
}
