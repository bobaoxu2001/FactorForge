import { describe, expect, it } from "vitest";
import { classifyMemo } from "./quality";
import type { HypothesisView, QualityCheck } from "./types";

const check = (id: string, state: QualityCheck["state"]): QualityCheck => ({ id, label: id, state, detail: "" });
const hyp = (overall: HypothesisView["overall"]): HypothesisView => ({
  id: "H",
  title: "",
  statement: "",
  stance: "neutral",
  marketNarrative: "",
  tests: [],
  overall,
  supportingEvidenceIds: [],
  contradictingEvidenceIds: [],
  triggers: [],
  missingEvidence: [],
});

describe("classifyMemo", () => {
  it("is evidence-backed only with no failures and every hypothesis decided", () => {
    expect(classifyMemo([check("primary-research", "pass")], [hyp("supports")])).toBe("evidence-backed");
  });
  it("is a draft when primary research is missing but core checks pass", () => {
    expect(classifyMemo([check("primary-research", "fail"), check("source-quality", "pass")], [hyp("mixed")])).toBe("draft-incomplete-verification");
  });
  it("is exploratory when core evidence is missing", () => {
    expect(classifyMemo([check("testability", "fail")], [hyp("insufficient-data")])).toBe("exploratory");
  });
});
