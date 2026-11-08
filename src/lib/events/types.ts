/**
 * Event-intelligence domain types.
 *
 * Three questions are kept apart throughout, because conflating them is how
 * research turns into narrative:
 *   1. What kind of statement is this?          → EpistemicClass
 *   2. How well is it sourced, as of a date?    → VerificationState (derived, never typed in)
 *   3. Where is it in its legal or operational life? → LifecycleState
 * A proposal that is well sourced is CONFIRMED + PROPOSED, never ENACTED.
 */

// ── Taxonomy ────────────────────────────────────────────────────────────────

/** Extensible: add a key here and a row in EVENT_CATEGORIES. */
export type EventCategory =
  | "cyber-breach"
  | "ai-security"
  | "policy-regulation"
  | "election"
  | "ai-datacenter-restriction"
  | "infrastructure-constraint"
  | "earnings-guidance"
  | "macro-rates-liquidity"
  | "supply-chain"
  | "industry-pricing-demand"
  | "geopolitical"
  | "company-operational"
  | "market-dislocation";

export type EpistemicClass =
  | "OBSERVED_FACT"
  | "REPORTED_CLAIM"
  | "ANALYST_INTERPRETATION"
  | "CAUSAL_HYPOTHESIS"
  | "MODEL_ESTIMATE"
  | "UNKNOWN";

export type VerificationState = "RUMOR" | "REPORTED" | "CORROBORATED" | "CONFIRMED" | "DISPUTED";

/** OPEN = an incident still in progress; the rest follow the policy life cycle. */
export type LifecycleState = "OPEN" | "PROPOSED" | "ENACTED" | "IMPLEMENTED" | "REVISED" | "RESOLVED";

// ── Sources ─────────────────────────────────────────────────────────────────

export type SourceTier =
  | "primary-official" // government, regulator, court, legislature
  | "primary-company" // the subject company's own statement (an interested party)
  | "primary-technical" // original incident or research report by the investigating party
  | "market-data" // auditable price or economic dataset
  | "independent-reporting" // newsroom with editorial accountability
  | "secondary-aggregator"; // rewrites, blogs, aggregators

export type RetrievalState = "read" | "blocked" | "not-attempted";

export interface SourceRecord {
  id: string;
  title: string;
  publisher: string;
  url: string;
  tier: SourceTier;
  /**
   * ISO 8601 with an explicit offset. When only the day is known, use the end
   * of that day in the publisher's time zone and set precision "day", so the
   * source is never treated as available earlier than it could have been.
   */
  publishedAt: string;
  publishedPrecision: "minute" | "day";
  /** When this platform read the source. */
  retrievedAt: string;
  retrieval: RetrievalState;
  retrievalNote?: string;
  /** Set when this item republishes another source (wire copy, AMP page, syndication). */
  republishes?: string;
  /** Wire or newsroom that originated the content, when credited. */
  originator?: string;
  /** True when the publisher is a party to the event (e.g. the breached company). */
  interestedParty?: boolean;
}

// ── Claims ──────────────────────────────────────────────────────────────────

export type QuantityKind = "affected" | "stolen" | "frozen" | "replenished" | "recovered" | "outflow-gross" | "outflow-net" | "price-move" | "capex-guidance" | "share";

export interface Quantity {
  kind: QuantityKind;
  value: number;
  unit: "USD" | "pct" | "BTC" | "ETH" | "count" | "MW";
  /** The moment the figure describes, not when it was published. */
  asOf: string;
  approximate?: boolean;
  lowerBound?: boolean;
}

export interface Citation {
  sourceId: string;
  /** Short paraphrase of what this source says. Not a verbatim excerpt. */
  says: string;
  /** "contradicts" marks a source that disputes the claim. */
  stance?: "supports" | "contradicts";
  /** The source repeats the claim on someone else's authority (e.g. a company citing the FBI). */
  secondHand?: boolean;
  /** No named source behind the statement. */
  unattributed?: boolean;
}

export interface Claim {
  id: string;
  eventId: string;
  statement: string;
  epistemic: EpistemicClass;
  topic: string;
  citations: Citation[];
  /**
   * The claim is about the source's own actions or statements (a company
   * describing what it did). A primary-company source can confirm those, but
   * never a claim about third parties or causes.
   */
  aboutSourceOwnConduct?: boolean;
  /** Only a primary-official source can confirm (attribution, enactment). */
  requiresOfficial?: boolean;
  lifecycle?: LifecycleState;
  quantity?: Quantity;
  /** Topics for thesis materiality (e.g. "capex-guidance", "outflows"). */
  tags?: string[];
  /** When the platform recorded the claim (append-only log time). */
  recordedAt: string;
  /** Claim this one refines or replaces, kept for the audit trail. */
  supersedes?: string;
  notes?: string;
  /**
   * Wording fixed after re-reading a source. The claim keeps its id and
   * recordedAt; each entry says what changed and why, so the correction is
   * visible rather than silent.
   */
  corrections?: Array<{ at: string; note: string }>;
}

// ── Events ──────────────────────────────────────────────────────────────────

export interface TimelineEntry {
  at: string;
  precision: "minute" | "day";
  label: string;
  claimIds: string[];
}

export interface CompetingExplanation {
  id: string;
  label: string;
  epistemic: EpistemicClass;
  summary: string;
  /** Claims or market checks consistent with it. */
  supportedBy: string[];
  /** Claims or market checks against it. */
  challengedBy: string[];
}

export interface EventRecord {
  id: string;
  title: string;
  categories: EventCategory[];
  summary: string;
  occurredAt: string;
  occurredPrecision: "minute" | "day";
  /** Market time zone used to locate the first tradable session. */
  jurisdictions: string[];
  entities: Array<{ name: string; role: string; ticker?: string; listed: boolean }>;
  /** Claims whose verification determines the event's verification. */
  coreClaimIds: string[];
  lifecycle: LifecycleState;
  instruments: string[];
  industries: string[];
  openQuestions: string[];
  competingExplanations: CompetingExplanation[];
  timeline: TimelineEntry[];
  /** Other registered events whose market windows overlap this one. */
  relatedEventIds?: string[];
  researchImpact: string;
}

// ── Derived views ───────────────────────────────────────────────────────────

export interface ClaimView extends Claim {
  verification: VerificationState;
  verificationReason: string;
  /** Earliest time any supporting source was available. */
  firstAvailableAt: string;
  independentSupport: number;
  /** Lifecycle after the guard: an enactment no official source confirms reads as PROPOSED. */
  effectiveLifecycle?: LifecycleState;
  lifecycleGuard?: string;
}

export interface EventView {
  event: EventRecord;
  asOf: string;
  claims: ClaimView[];
  sources: SourceRecord[];
  verification: VerificationState;
  firstPublishedAt: string | null;
  lastVerifiedAt: string | null;
  confidence: "high" | "medium" | "low";
  confidenceReason: string;
  hiddenClaimCount: number;
}
