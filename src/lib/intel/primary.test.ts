import { describe, expect, it } from "vitest";
import { FREIGHT_PROJECT } from "@/data/research/projects/freight";
import { analyzeNotes, buildInterviewGuide, contradictionsWithHypotheses, crossSourceAgreement, redactPersonalData, screenText } from "./primary";

describe("compliance screening", () => {
  it("flags personal data and MNPI language", () => {
    const flags = screenText("Call jane.doe@example.com or 555-123-4567. Their Q4 numbers are not yet public; this is confidential.");
    const kinds = flags.map((f) => f.kind);
    expect(kinds).toEqual(expect.arrayContaining(["pii-email", "pii-phone", "mnpi-language", "confidentiality"]));
  });
  it("passes ordinary market commentary", () => {
    expect(screenText("Spot rates feel firmer than last month and more trucks are parked.")).toEqual([]);
  });
  it("redacts contact details", () => {
    expect(redactPersonalData("mail a@b.co, call (555) 123-4567")).toBe("mail [email removed], call [phone removed]");
  });
});

describe("interview guides", () => {
  it("are templates tied to hypotheses with compliance cautions", () => {
    const guide = buildInterviewGuide(FREIGHT_PROJECT.stakeholders[0], FREIGHT_PROJECT.hypotheses);
    expect(guide.origin).toBe("template");
    expect(guide.hypotheses.length).toBeGreaterThan(0);
    expect(guide.opening.join(" ")).toMatch(/material non-public/);
  });
});

describe("note analysis", () => {
  const a = analyzeNotes("Shipments are down 6% versus last year. Spot rates are lower and softening. Fuel surcharges are higher. More small carriers are exiting.");
  it("extracts themes, direction and numeric indicators", () => {
    expect(a.themes.find((t) => t.theme === "volume")?.direction).toBe("down");
    expect(a.themes.find((t) => t.theme === "pricing")?.direction).toBe("down");
    expect(a.indicators.some((i) => i.value.includes("6%"))).toBe(true);
  });
  it("detects contradictions with hypotheses", () => {
    const c = contradictionsWithHypotheses(a);
    expect(c.some((x) => x.hypothesisId === "H1" && x.theme === "volume")).toBe(true);
    expect(c.some((x) => x.hypothesisId === "H2")).toBe(true);
  });
  it("compares sources and marks disagreement", () => {
    const b = analyzeNotes("Loads are up and volumes are improving.");
    const rows = crossSourceAgreement([
      { id: "1", label: "Carrier A", analysis: a },
      { id: "2", label: "Shipper B", analysis: b },
    ]);
    expect(rows.find((r) => r.theme === "volume")?.agreement).toBe("disagree");
  });
});
