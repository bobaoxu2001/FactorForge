import { describe, expect, it } from "vitest";
import { pct } from "@/lib/utils/format";
import { buildMemoSections, variantView } from "./memo";
import { getResearchProject, type ResearchProjectView } from "./project";

const view = getResearchProject("freight", new Date("2026-11-01T12:00:00Z"))!;

describe("evidence-bounded research interpretation", () => {
  it("preserves the observed pricing numbers without treating the residual as a causal fuel decomposition", () => {
    const residual = view.residuals.find((r) => r.kpiId === "ppi-truckload")!.latest!;
    const pricing = variantView(view).find((p) => p.includes("historical diesel sensitivity"))!;

    expect(pricing).toContain(pct(residual.actual));
    expect(pricing).toContain(`${Math.abs(residual.residual * 100).toFixed(1)}pp`);
    expect(pricing).toContain("[EV-CALC-ppi-truckload-FUEL]");
    expect(pricing).toContain("does not isolate fuel-surcharge pass-through");
    expect(pricing).toContain("contract-reset timing");
    expect(pricing).toContain("would challenge this view");
    expect(pricing).toContain("rate feeds are not connected");
    expect(pricing).not.toContain('the price "recovery" is a fuel-cost pass-through');
  });

  it("also bounds a positive pricing signal and surfaces extrapolation risk", () => {
    const positive: ResearchProjectView = {
      ...view,
      hypotheses: view.hypotheses.map((h) => h.id === "H2" ? {
        ...h,
        tests: h.tests.map((t) => t.id === "H2-T2" ? { ...t, outcome: "supports" } : t),
      } : h),
      residuals: view.residuals.map((r) => r.kpiId === "ppi-truckload" ? {
        ...r,
        extrapolation: true,
        latest: { ...r.latest!, residual: 0.031 },
      } : r),
    };
    const pricing = variantView(positive).find((p) => p.includes("historical diesel sensitivity"))!;

    expect(pricing).toContain("+3.1pp");
    expect(pricing).toContain("model error");
    expect(pricing).toContain("Confirm it against matched ex-fuel rate");
    expect(pricing).toContain("outside the model's training range");
    expect(pricing).not.toContain("more than diesel explains");
  });

  it("flags mixed reporting periods instead of claiming a business-model or stock-selection advantage", () => {
    const paragraph = variantView(view).find((p) => p.includes("operating-leverage advantage"))!;
    const periods = [...new Set(view.companies.map((c) => c.latest?.label).filter(Boolean))];

    expect(periods.length).toBeGreaterThan(1);
    for (const period of periods) expect(paragraph).toContain(period);
    expect(paragraph).toContain("comparison is provisional");
    expect(paragraph).toContain("matched quarters");
    expect(paragraph).not.toContain("stock selection matters more than sector exposure");
  });

  it("does not infer investor expectations from relative returns and trailing multiples", () => {
    const paragraph = variantView(view).find((p) => p.includes("H6 screens"))!;

    expect(paragraph).toContain("do not identify investor expectations");
    expect(paragraph).toContain("no consensus estimates are connected");
    expect(paragraph).not.toContain("Equities do not look priced for a recovery");
    expect(paragraph).not.toContain("would therefore be a variant positive");
  });

  it("carries the interpretation limits into the exported memo and provides testable next checks", () => {
    const sections = buildMemoSections(view);
    const risks = sections.find((s) => s.id === "risks")!.body.join(" ");
    const actions = sections.find((s) => s.id === "next-actions")!.body.join(" ");
    const known = new Set(view.evidence.map((e) => e.id));

    expect(risks).toContain("not a causal estimate");
    expect(risks).toContain("different reporting periods");
    expect(actions).toContain("matched ex-fuel spot and contract rates");
    expect(actions).toContain("same reporting quarters");
    expect(actions).toContain("forward earnings estimates");
    for (const paragraph of variantView(view)) {
      for (const id of paragraph.match(/EV-[A-Za-z0-9-]+/g) ?? []) expect(known.has(id), id).toBe(true);
    }
  });
});
