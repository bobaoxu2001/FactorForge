import { atLeast, availableAt, verifyClaim } from "./verification";
import { parseInstant, toIso } from "./time";
import type { Claim, LifecycleState, SourceRecord, VerificationState } from "./types";

/**
 * Continuous thesis revision.
 *
 * A thesis is written once, hashed into the ledger and never edited. Its
 * history is *replayed*: walk forward through the moments new evidence became
 * available, evaluate the thesis's own triggers, and record a revision only
 * when a trigger fires. Consequences:
 *   - The original statement survives every revision verbatim.
 *   - New evidence that touches no trigger is logged as reviewed, not acted on:
 *     an event with no material impact does not force a revision.
 *   - Price triggers can only move a thesis to UNDER_REVIEW. A price move is a
 *     prompt to look again, never by itself a reason to change the conclusion.
 *   - For a live thesis, evidence counts from when the platform recorded it,
 *     so a claim added later with an old publication date lands at the time it
 *     was learned and cannot rewrite earlier revisions. Backfilled (worked
 *     example) theses replay on publication time and say so.
 */

export type ThesisStatus = "ACTIVE" | "STRENGTHENED" | "WEAKENED" | "UNDER_REVIEW" | "INVALIDATED" | "CLOSED";
export type TriggerEffect = "strengthen" | "weaken" | "invalidate" | "review";

export interface Assumption {
  id: string;
  text: string;
  critical: boolean;
}

export type TriggerCondition =
  | { kind: "claim"; claimId: string; atLeast?: VerificationState; lifecycleIn?: LifecycleState[] }
  | { kind: "tag"; tag: string; atLeast?: VerificationState }
  | { kind: "market"; observationId: string; op: "<" | ">"; threshold: number };

export interface Trigger {
  id: string;
  description: string;
  condition: TriggerCondition;
  effect: TriggerEffect;
  assumptionId?: string;
  /** Why the conclusion moves when this fires. */
  explanation: string;
  /** What the earlier view got wrong, if this fires against it. */
  lesson?: string;
}

export interface ThesisRecord {
  id: string;
  caseId: string;
  eventId: string;
  title: string;
  question: string;
  statement: string;
  horizonLabel: string;
  /** Date (YYYY-MM-DD) after which the thesis is closed and scored. */
  horizonEnd: string;
  informationCutoff: string;
  publishedAt: string;
  authoredAt: string;
  origin: "live" | "backfill";
  originNote?: string;
  assumptions: Assumption[];
  supportingClaimIds: string[];
  contradictingClaimIds: string[];
  monitor: Array<{ label: string; detail: string }>;
  triggers: Trigger[];
  forecastIds: string[];
  /** How the thesis is scored at its horizon: a market observation and the condition that means "right". */
  outcome?: { observationId: string; op: "<" | ">"; threshold: number; description: string };
  prevHash?: string;
  hash?: string;
}

/** A timed market measurement a market trigger can test (e.g. 5-bar abnormal return). */
export interface MarketObservation {
  id: string;
  label: string;
  value: number | null;
  observedAt: string | null;
}

export interface FiredTrigger {
  id: string;
  description: string;
  effect: TriggerEffect;
  evidence: string[];
}

export interface Revision {
  seq: number;
  at: string;
  from: ThesisStatus;
  to: ThesisStatus;
  fired: FiredTrigger[];
  explanation: string;
  lessons: string[];
  assumptionUpdates: Array<{ assumptionId: string; holds: boolean }>;
  /** New claims seen at this checkpoint that touched no trigger. */
  reviewedWithoutChange: string[];
  reconstructed: boolean;
}

export interface ThesisReplay {
  thesis: ThesisRecord;
  asOf: string;
  status: ThesisStatus;
  revisions: Revision[];
  /** Claims that arrived after the cutoff and moved nothing. */
  immaterialClaims: string[];
  /** Claims that became available after the horizon closed; they inform the post-mortem, not the record. */
  postHorizonClaims: string[];
  assumptions: Array<Assumption & { holds: boolean | null }>;
  pendingTriggers: Trigger[];
}

const SEVERITY: Record<TriggerEffect, number> = { invalidate: 3, weaken: 2, review: 1, strengthen: 0 };

function nextStatus(current: ThesisStatus, effects: TriggerEffect[]): ThesisStatus {
  if (current === "INVALIDATED" || current === "CLOSED") return current;
  if (effects.includes("invalidate")) return "INVALIDATED";
  const hasUp = effects.includes("strengthen");
  const hasDown = effects.includes("weaken");
  if (hasUp && hasDown) return "UNDER_REVIEW";
  if (hasDown) return "WEAKENED";
  if (effects.includes("review")) return "UNDER_REVIEW";
  if (hasUp) return "STRENGTHENED";
  return current;
}

/** Sources as the replay should see them: live theses count evidence from when it was recorded. */
function sourcesForReplay(thesis: ThesisRecord, claims: Claim[], sources: SourceRecord[]): { claims: Claim[]; sources: SourceRecord[] } {
  if (thesis.origin === "backfill") return { claims, sources };
  // Per-claim shadow sources dated max(published, recorded).
  const byId = new Map(sources.map((s) => [s.id, s]));
  const shadow: SourceRecord[] = [];
  const remapped = claims.map((c) => ({
    ...c,
    citations: c.citations.map((cit) => {
      const s = byId.get(cit.sourceId);
      if (!s) return cit;
      const at = Math.max(availableAt(s), parseInstant(c.recordedAt, `${c.id}.recordedAt`));
      const id = `${s.id}@${c.id}`;
      shadow.push({ ...s, id, publishedAt: toIso(at) });
      return { ...cit, sourceId: id };
    }),
  }));
  return { claims: remapped, sources: [...sources, ...shadow] };
}

/**
 * Wording rules for triggers, in force for theses published from this
 * instant. Earlier theses are immutable, so they are not rejected; the same
 * rules are reported beside them as a current assessment instead.
 */
export const THESIS_RULES_V2_FROM = "2026-11-08T10:00:00Z";

/**
 * A trigger must not claim more than its condition can show:
 * - a label that says "confirmed" needs a CONFIRMED threshold;
 * - a label that calls something a driver or cause asserts causation, which no
 *   verification state of a claim can establish; it may only prompt a review;
 * - a claim labelled a causal hypothesis cannot strengthen, weaken or invalidate.
 */
export function triggerWordingFindings(thesis: ThesisRecord, claims: Claim[]): string[] {
  const byId = new Map(claims.map((c) => [c.id, c]));
  const out: string[] = [];
  for (const t of thesis.triggers) {
    if (t.condition.kind === "market") continue;
    const label = t.description.toLowerCase();
    const threshold = t.condition.atLeast;
    if (/\bconfirm/.test(label) && threshold !== "CONFIRMED") out.push(`${t.id}: says "confirmed" but fires at ${threshold}`);
    if (/\b(driver|caused?|because)\b/.test(label) && t.effect !== "review") out.push(`${t.id}: treats a cause as established; whether something drove a move is a hypothesis, so this can only prompt a review`);
    if (t.condition.kind === "claim" && byId.get(t.condition.claimId)?.epistemic === "CAUSAL_HYPOTHESIS" && t.effect !== "review") out.push(`${t.id}: keys on a causal hypothesis (${t.condition.claimId}) and may only prompt a review`);
  }
  return out;
}

export function validateThesis(thesis: ThesisRecord, claims: Claim[], observations: MarketObservation[], sources?: SourceRecord[]): string[] {
  const problems: string[] = [];
  if (parseInstant(thesis.publishedAt) >= parseInstant(THESIS_RULES_V2_FROM)) problems.push(...triggerWordingFindings(thesis, claims));
  if (sources) {
    // Evidence cited at publication must have been available at the cutoff (no hindsight).
    const view = sourcesForReplay(thesis, claims, sources);
    const cutoffMs = parseInstant(thesis.informationCutoff);
    for (const id of [...thesis.supportingClaimIds, ...thesis.contradictingClaimIds]) {
      const claim = view.claims.find((c) => c.id === id);
      if (claim && !verifyClaim(claim, view.sources, cutoffMs)) problems.push(`cites ${id}, which no source had published by the information cutoff`);
    }
  }
  const claimIds = new Set(claims.map((c) => c.id));
  const assumptionIds = new Set(thesis.assumptions.map((a) => a.id));
  const obsIds = new Set(observations.map((o) => o.id));
  if (parseInstant(thesis.publishedAt) < parseInstant(thesis.informationCutoff)) problems.push("published before its own information cutoff");
  for (const id of [...thesis.supportingClaimIds, ...thesis.contradictingClaimIds]) if (!claimIds.has(id)) problems.push(`unknown claim ${id}`);
  for (const t of thesis.triggers) {
    if (t.assumptionId && !assumptionIds.has(t.assumptionId)) problems.push(`${t.id}: unknown assumption ${t.assumptionId}`);
    if (t.condition.kind === "claim" && !claimIds.has(t.condition.claimId)) problems.push(`${t.id}: unknown claim ${t.condition.claimId}`);
    if (t.condition.kind === "market") {
      if (t.effect !== "review") problems.push(`${t.id}: a price trigger may only prompt a review, not change the conclusion`);
      if (!obsIds.has(t.condition.observationId)) problems.push(`${t.id}: unknown market observation ${t.condition.observationId}`);
    }
  }
  return problems;
}

export function replayThesis(
  thesis: ThesisRecord,
  allClaims: Claim[],
  allSources: SourceRecord[],
  observations: MarketObservation[],
  asOf: string,
): ThesisReplay {
  const { claims, sources } = sourcesForReplay(thesis, allClaims, allSources);
  const asOfMs = parseInstant(asOf, "asOf");
  const startMs = parseInstant(thesis.publishedAt, `${thesis.id}.publishedAt`);
  const cutoffMs = parseInstant(thesis.informationCutoff, `${thesis.id}.informationCutoff`);
  const obsById = new Map(observations.map((o) => [o.id, o]));
  const horizonEndMs = Date.parse(`${thesis.horizonEnd}T23:59:59Z`);
  // Evidence after the horizon cannot revise a closed thesis; it is reported separately.
  const lastMs = Math.min(asOfMs, horizonEndMs);

  // Checkpoints: every moment a cited source became available, plus market observations, after publication.
  const cited = new Set(claims.flatMap((c) => c.citations.map((x) => x.sourceId)));
  const times = new Set<number>();
  for (const s of sources) {
    if (!cited.has(s.id) || s.retrieval !== "read") continue;
    const t = availableAt(s);
    if (t > startMs && t <= lastMs) times.add(t);
  }
  for (const o of observations) {
    if (!o.observedAt) continue;
    const t = parseInstant(o.observedAt);
    if (t > startMs && t <= lastMs) times.add(t);
  }
  const checkpoints = [...times].sort((a, b) => a - b);

  const fired = new Set<string>();
  const seenClaims = new Set(claims.filter((c) => verifyClaim(c, sources, cutoffMs)).map((c) => c.id));
  const triggerClaimIds = new Set(
    thesis.triggers.flatMap((t) => (t.condition.kind === "claim" ? [t.condition.claimId] : t.condition.kind === "tag" ? claims.filter((c) => c.tags?.includes((t.condition as { tag: string }).tag)).map((c) => c.id) : [])),
  );
  const holds = new Map<string, boolean>();
  const revisions: Revision[] = [];
  const immaterial: string[] = [];
  let status: ThesisStatus = "ACTIVE";

  for (const t of checkpoints) {
    const views = new Map(claims.map((c) => [c.id, verifyClaim(c, sources, t)]));
    const newlyVisible = [...views.entries()].filter(([id, v]) => v && !seenClaims.has(id)).map(([id]) => id);
    newlyVisible.forEach((id) => seenClaims.add(id));

    const firing: Array<{ trigger: Trigger; evidence: string[] }> = [];
    for (const trigger of thesis.triggers) {
      if (fired.has(trigger.id)) continue;
      const c = trigger.condition;
      if (c.kind === "claim") {
        const v = views.get(c.claimId);
        if (!v) continue;
        if (c.atLeast && !atLeast(v.verification, c.atLeast)) continue;
        if (c.lifecycleIn && !(v.effectiveLifecycle && c.lifecycleIn.includes(v.effectiveLifecycle))) continue;
        firing.push({ trigger, evidence: [c.claimId] });
      } else if (c.kind === "tag") {
        const hits = [...views.values()].filter((v) => v && v.tags?.includes(c.tag) && (!c.atLeast || atLeast(v.verification, c.atLeast)));
        if (hits.length) firing.push({ trigger, evidence: hits.map((v) => v!.id) });
      } else {
        const o = obsById.get(c.observationId);
        if (!o || o.value === null || !o.observedAt || parseInstant(o.observedAt) > t) continue;
        if (c.op === "<" ? o.value < c.threshold : o.value > c.threshold) firing.push({ trigger, evidence: [o.id] });
      }
    }

    const reviewed = newlyVisible.filter((id) => !triggerClaimIds.has(id));
    immaterial.push(...reviewed);
    if (firing.length === 0) continue;

    firing.sort((a, b) => SEVERITY[b.trigger.effect] - SEVERITY[a.trigger.effect]);
    firing.forEach((f) => fired.add(f.trigger.id));
    const from = status;
    status = nextStatus(status, firing.map((f) => f.trigger.effect));
    const assumptionUpdates = firing
      .filter((f) => f.trigger.assumptionId)
      .map((f) => ({ assumptionId: f.trigger.assumptionId!, holds: f.trigger.effect === "strengthen" }));
    assumptionUpdates.forEach((u) => holds.set(u.assumptionId, u.holds));
    revisions.push({
      seq: revisions.length + 1,
      at: toIso(t),
      from,
      to: status,
      fired: firing.map((f) => ({ id: f.trigger.id, description: f.trigger.description, effect: f.trigger.effect, evidence: f.evidence })),
      explanation: firing.map((f) => f.trigger.explanation).join(" "),
      lessons: firing.filter((f) => f.trigger.effect !== "strengthen" && f.trigger.lesson).map((f) => f.trigger.lesson!),
      assumptionUpdates,
      reviewedWithoutChange: reviewed,
      reconstructed: thesis.origin === "backfill",
    });
  }

  if (horizonEndMs <= asOfMs && status !== "INVALIDATED") {
    revisions.push({
      seq: revisions.length + 1,
      at: toIso(horizonEndMs),
      from: status,
      to: "CLOSED",
      fired: [],
      explanation: `The thesis horizon (${thesis.horizonLabel}) has ended; it is closed and scored against what happened.`,
      lessons: [],
      assumptionUpdates: [],
      reviewedWithoutChange: [],
      reconstructed: thesis.origin === "backfill",
    });
    status = "CLOSED";
  }

  const postHorizonClaims =
    horizonEndMs < asOfMs
      ? claims.filter((c) => !verifyClaim(c, sources, horizonEndMs) && verifyClaim(c, sources, asOfMs)).map((c) => c.id)
      : [];

  return {
    thesis,
    asOf,
    status,
    revisions,
    immaterialClaims: immaterial,
    postHorizonClaims,
    assumptions: thesis.assumptions.map((a) => ({ ...a, holds: holds.has(a.id) ? holds.get(a.id)! : null })),
    pendingTriggers: thesis.triggers.filter((t) => !fired.has(t.id)),
  };
}
