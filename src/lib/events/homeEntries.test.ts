// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AI_DATACENTER_CASE } from "@/data/events/cases/aiDatacenter";
import { caseStages } from "./caseNav";
import { caseUpdatesHref, featuredCase, otherEventCases } from "./homeEntries";

describe("homepage case entries", () => {
  it("features the AI case and opens it on its brief", () => {
    const f = featuredCase();
    expect(f.slug).toBe("ai-datacenter-shock");
    expect(f.briefHref).toBe("/events/ai-datacenter-shock/brief");
  });

  it("shows the shared assessment unshortened, with its uncertainty", () => {
    const f = featuredCase();
    const a = AI_DATACENTER_CASE.currentAssessment!;
    expect(f.question).toBe(a.question);
    expect(f.view).toBe(a.view);
    expect(f.view).toMatch(/not established the cause/);
    expect(f.keyUncertainty).toBe(a.uncertainty[0].text);
    expect(f.interpretation).toBe(a.interpretation.strength);
    expect(f.assessedAt).toBe(a.at);
  });

  it("opens the other event cases on their briefs and says when no assessment is written", () => {
    const others = otherEventCases();
    expect(others.map((o) => o.briefHref)).toContain("/events/binance-breach/brief");
    expect(others.find((o) => o.slug === "binance-breach")!.hasAssessment).toBe(false);
  });

  it("keeps the homepage free of its own copy of the conclusion", () => {
    const page = readFileSync(path.join(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(page.includes(AI_DATACENTER_CASE.currentAssessment!.view.slice(0, 50))).toBe(false);
    expect(page).not.toMatch(/unchanged engine/);
    expect(page).not.toMatch(/Upcoming catalysts/);
  });
});

describe("case navigation keeps Updates", () => {
  it("leads with the brief and keeps the case root as Updates", () => {
    const stages = caseStages({ confirmed: 1, claims: 2, windows: 3 });
    expect(stages[0]).toMatchObject({ slug: "brief", label: "Brief" });
    expect(stages.find((s) => s.slug === "")).toMatchObject({ label: "Updates" });
    expect(caseUpdatesHref("ai-datacenter-shock")).toBe("/events/ai-datacenter-shock");
  });
});
