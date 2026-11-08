// @vitest-environment node
import { describe, expect, it } from "vitest";
import thesisLedger from "@/data/events/thesis-ledger.json";
import { ALL_CLAIMS, ALL_SOURCES } from "@/data/events";
import { verifyChain } from "./ledger";
import { replayThesis, validateThesis, type MarketObservation, type ThesisRecord } from "./thesis";
import type { Claim, SourceRecord } from "./types";
import { ALL_THESES, observations, thesisContentHash, thesisViews } from "./view";

const thesis = (id: string) => ALL_THESES.find((t) => t.id === id)!;
const view = (id: string) => thesisViews().find((v) => v.replay.thesis.id === id)!;

describe("thesis replay on the seeded cases", () => {
  it("strengthens the Binance thesis when withdrawals reopen and replenishment is reported, then closes it", () => {
    const v = view("T-BNB-1");
    const [first, last] = [v.replay.revisions[0], v.replay.revisions.at(-1)!];
    expect(first.to).toBe("STRENGTHENED");
    expect(first.fired.map((f) => f.id).sort()).toEqual(["TR-B1", "TR-B2"]);
    expect(first.at).toBe("2026-11-01T12:29:00.000Z");
    expect(first.reconstructed).toBe(true);
    expect(last.to).toBe("CLOSED");
    expect(v.replay.status).toBe("CLOSED");
  });

  it("does not let evidence after the horizon revise a closed thesis, but reports it", () => {
    const v = view("T-BNB-1");
    expect(v.replay.revisions.some((r) => r.fired.some((f) => f.id === "TR-B3"))).toBe(false);
    expect(v.replay.postHorizonClaims).toContain("B-C22");
  });

  it("scores the closed thesis against its stated market outcome", () => {
    expect(["right", "wrong"]).toContain(view("T-BNB-1").outcome.state);
  });

  it("logs evidence that touches no trigger as reviewed without change", () => {
    const v = view("T-AI-1");
    expect(v.replay.immaterialClaims).toContain("A-C26"); // the 6 Nov rebound is a price move, not a reason
    expect(v.replay.revisions.every((r) => r.fired.every((f) => f.id !== "TR-A3"))).toBe(true); // aggregator-only capex claim is too weak
  });

  it("keeps the original statement verbatim through every revision", () => {
    const v = view("T-AI-1");
    expect(v.replay.thesis.statement).toBe(thesis("T-AI-1").statement);
    expect(v.integrity).toEqual({ recorded: true, matches: true });
  });
});

describe("immutable thesis history", () => {
  it("has an intact thesis ledger whose hashes match the case files", () => {
    expect(verifyChain(thesisLedger as unknown as Array<{ id: string; hash: string; prevHash: string }>).ok).toBe(true);
    for (const t of ALL_THESES) {
      const entry = (thesisLedger as Array<{ id: string; contentHash: string }>).find((x) => x.id === t.id);
      expect(entry?.contentHash, t.id).toBe(thesisContentHash(t));
    }
  });

  it("detects an edit to a published thesis", () => {
    const edited = { ...thesis("T-AI-1"), statement: "Something else." };
    expect(thesisContentHash(edited)).not.toBe(thesisContentHash(thesis("T-AI-1")));
  });

  it("does not rewrite a live thesis's past when a back-dated claim is recorded later", () => {
    const t: ThesisRecord = {
      ...thesis("T-AI-1"),
      id: "T-LIVE",
      origin: "live",
      publishedAt: "2026-11-05T16:30:00-05:00",
      informationCutoff: "2026-11-05T16:30:00-05:00",
      horizonEnd: "2027-02-28",
      triggers: [{ id: "TR-X", description: "capex cut", condition: { kind: "tag", tag: "capex-cut", atLeast: "REPORTED" }, effect: "weaken", assumptionId: "A2", explanation: "cut" }],
    };
    const late: SourceRecord = { id: "S-LATE", title: "t", publisher: "Wire", url: "https://example.com/late", tier: "independent-reporting", publishedAt: "2026-11-06T10:00:00Z", publishedPrecision: "minute", retrievedAt: "2026-11-20T00:00:00Z", retrieval: "read" };
    const backdated: Claim = { id: "C-LATE", eventId: "EV-AI-SELLOFF-2026-11-05", statement: "A hyperscaler cut capex.", epistemic: "REPORTED_CLAIM", topic: "x", citations: [{ sourceId: "S-LATE", says: "cut" }], tags: ["capex-cut"], recordedAt: "2026-11-20T00:00:00Z" };
    const before = replayThesis(t, ALL_CLAIMS, ALL_SOURCES, [], "2026-11-25T00:00:00Z");
    const after = replayThesis(t, [...ALL_CLAIMS, backdated], [...ALL_SOURCES, late], [], "2026-11-25T00:00:00Z");
    const weaken = after.revisions.find((r) => r.fired.some((f) => f.id === "TR-X"))!;
    expect(weaken.at).toBe("2026-11-20T00:00:00.000Z"); // when it was learned, not 6 Nov
    expect(after.revisions.slice(0, before.revisions.length)).toEqual(before.revisions);
  });
});

describe("rules on what may change a conclusion", () => {
  it("rejects a price trigger that tries to weaken or invalidate", () => {
    const t: ThesisRecord = { ...thesis("T-AI-1"), triggers: [{ id: "BAD", description: "price", condition: { kind: "market", observationId: "OBS-A-SMH-20", op: "<", threshold: -0.1 }, effect: "invalidate", explanation: "x" }] };
    expect(validateThesis(t, ALL_CLAIMS, observations())).toEqual([expect.stringMatching(/price trigger may only prompt a review/)]);
  });

  it("validates all seeded theses, including that their cited evidence existed at the cutoff", () => {
    for (const t of ALL_THESES) expect(validateThesis(t, ALL_CLAIMS, observations(), ALL_SOURCES), t.id).toEqual([]);
  });

  it("rejects a thesis that cites evidence published after its cutoff", () => {
    const t: ThesisRecord = { ...thesis("T-AI-1"), supportingClaimIds: ["A-C09"] }; // first reported 6 Nov
    expect(validateThesis(t, ALL_CLAIMS, observations(), ALL_SOURCES)).toEqual([expect.stringMatching(/no source had published/)]);
  });

  it("moves to UNDER_REVIEW, not INVALIDATED, when a price trigger fires", () => {
    const t: ThesisRecord = {
      ...thesis("T-AI-1"),
      triggers: [{ id: "PX", description: "price", condition: { kind: "market", observationId: "OBS-X", op: "<", threshold: -0.1 }, effect: "review", explanation: "look again" }],
    };
    const obs: MarketObservation[] = [{ id: "OBS-X", label: "x", value: -0.2, observedAt: "2026-11-10T21:00:00Z" }];
    const r = replayThesis(t, ALL_CLAIMS, ALL_SOURCES, obs, "2026-11-11T00:00:00Z");
    expect(r.status).toBe("UNDER_REVIEW");
  });

  it("records what the earlier view got wrong when a weakening trigger fires", () => {
    const t: ThesisRecord = {
      ...thesis("T-AI-1"),
      triggers: [{ id: "TW", description: "earnings", condition: { kind: "tag", tag: "positioning", atLeast: "REPORTED" }, effect: "weaken", explanation: "x", lesson: "It missed positioning." }],
    };
    const r = replayThesis(t, ALL_CLAIMS, ALL_SOURCES, [], "2026-11-08T04:00:00Z");
    expect(r.revisions[0].lessons).toEqual(["It missed positioning."]);
  });
});
