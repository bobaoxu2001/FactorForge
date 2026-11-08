// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AI_DATACENTER_CASE as C } from "@/data/events/cases/aiDatacenter";
import { buildEventMemo } from "./memo";
import { parseInstant } from "./time";

/**
 * Current wording versus labelled history. Current summaries (the current
 * assessment, the company case, impact-map links, event descriptions and
 * claim notes) must not turn missing evidence into universal absence, must
 * not date an earnings effect from a hedge percentage, and must not rank
 * exposure without a comparison. Earlier wording is kept, dated, in history
 * and corrections, and is deliberately excluded from these checks.
 */

const a = C.currentAssessment!;
const cc = C.companyCases![0];

const currentTexts: string[] = [
  a.question,
  a.view,
  a.interpretation.reason,
  a.whyItMatters,
  a.nextStep,
  ...a.strongest.map((x) => x.text),
  ...a.uncertainty.map((x) => x.text),
  ...a.wouldChange.map((x) => x.text),
  cc.question,
  cc.whyThisCompany,
  cc.exposureNote,
  cc.expectationGap.note,
  ...cc.criticalAssumptions,
  ...cc.unknowns,
  ...cc.figures.flatMap((f) => [f.label, f.qualification ?? ""]),
  ...cc.channels.flatMap((ch) => [ch.mechanism, ch.financialImplication, ch.timing, ch.assumption, ch.read]),
  ...cc.tests.flatMap((t) => [t.summary, t.mechanism ?? "", t.expectIfTrue ?? "", t.wouldWeaken ?? "", t.nextStep ?? ""]),
  ...C.graph.edges.flatMap((e) => [e.mechanism, e.establishes ?? "", e.assumption ?? "", e.wouldChallenge ?? ""]),
  ...C.events.flatMap((e) => [e.summary, e.researchImpact]),
  ...C.claims.flatMap((x) => [x.statement, x.notes ?? ""]),
].filter(Boolean);

const sentences = currentTexts.flatMap((t) => t.split(/(?<=[.;:])\s+/));

describe("current wording stays within the evidence", () => {
  it("scopes absence statements to the sources reviewed instead of claiming universal absence", () => {
    const universal = /\b(no|none of the)\s+(company|companies|hyperscaler|hyperscalers|supplier|suppliers)\b[^.]*\b(has|have|reported|updated)\b|\bnothing new was enacted\b/i;
    const scoped = /sources reviewed|documents (read|reviewed)|sources read|was not read|were not read/i;
    for (const s of sentences) if (universal.test(s)) expect(scoped.test(s), s).toBe(true);
  });

  it("does not rank exposure without a comparison", () => {
    for (const s of sentences) expect(s, s).not.toMatch(/most Texas-exposed|most direct line|largest Texas/i);
    expect(cc.whyThisCompany).toMatch(/not compared/);
  });

  it("does not let a hedge percentage date an earnings effect or stand for revenue protection", () => {
    for (const s of sentences.filter((x) => /hedg/i.test(x))) {
      expect(s, s).not.toMatch(/\b(from|after|until) 20\d\d\b|reaches earnings mainly|stay hedged|earnings hold|little effect on 20\d\d/i);
    }
    for (const f of cc.figures.filter((x) => x.id.startsWith("VST-HEDGE"))) expect(f.qualification, f.id).toMatch(/not stated/);
    const hedgeClaim = C.claims.find((x) => x.id === "A-C32")!;
    expect(hedgeClaim.notes).toMatch(/does not establish when/);
  });

  it("states the current view as consistent with, not proof of, a repricing", () => {
    expect(a.view).toMatch(/consistent with/);
    expect(a.view).toMatch(/not established the cause/);
    expect(a.view).not.toMatch(/evidence (so far )?shows/);
  });

  it("does not present guidance built on pre-election curves as a post-election reassessment", () => {
    const guidance = C.claims.find((x) => x.id === "A-C30")!;
    expect(guidance.notes).toMatch(/2 Nov/);
    for (const f of cc.figures.filter((x) => x.id.startsWith("VST-GUIDE"))) expect(f.qualification, f.id).toMatch(/2 Nov 2026/);
  });
});

describe("one corrected assessment across pages", () => {
  it("renders the corrected view in the memo, the company read in the memo, and the same view in the interview script", () => {
    const memo = buildEventMemo(C);
    expect(memo.find((s) => s.title === "Current assessment")!.paragraphs[0]).toContain(a.view);
    const company = memo.find((s) => s.title === `Company example: ${cc.company}`)!.paragraphs.join(" ");
    expect(company).toContain(cc.channels.find((x) => x.channel === "risk-premium")!.read);
    const script = readFileSync(path.join(process.cwd(), "docs/INTERVIEW_DEMO.md"), "utf8");
    expect(script).toContain(a.view);
    expect(script).not.toMatch(/\bI (picked|read|selected|validated)\b/);
    expect(script).toMatch(/\[AUTHOR TO COMPLETE\]/);
  });
});

describe("history is kept, dated and labelled", () => {
  it("keeps the 14:00 assessment verbatim as history and dates the correction after it", () => {
    const h = C.assessmentHistory!;
    expect(h).toHaveLength(1);
    expect(h[0].at).toBe("2026-11-08T14:00:00Z");
    expect(h[0].view).toBe(
      "Working view: the evidence so far shows policy risk being repriced in share prices, not a measured change in near-term demand. It cannot yet say how much of the 5 Nov decline was policy rather than positioning or valuation.",
    );
    expect(parseInstant(a.at)).toBeGreaterThan(parseInstant(h[0].at));
    expect(a.changes.some((x) => x.at === a.at)).toBe(true);
    expect(cc.revisions?.some((r) => r.at === a.at)).toBe(true);
  });

  it("dates claim corrections after the claim was recorded, never before", () => {
    for (const x of C.claims) for (const k of x.corrections ?? []) expect(parseInstant(k.at), x.id).toBeGreaterThanOrEqual(parseInstant(x.recordedAt));
  });
});
