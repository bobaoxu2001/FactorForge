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
  it("does not promote a report to verified from a passed interview-count check", () => {
    expect(classifyMemo([check("primary-research", "pass")], [hyp("supports")])).toBe("public-source");
  });
  it("recognizes public-source evidence when fieldwork is missing but core checks pass", () => {
    expect(classifyMemo([check("primary-research", "fail"), check("source-quality", "pass")], [hyp("mixed")])).toBe("public-source");
  });
  it("is exploratory when core evidence is missing", () => {
    expect(classifyMemo([check("testability", "fail")], [hyp("insufficient-data")])).toBe("exploratory");
  });
});
