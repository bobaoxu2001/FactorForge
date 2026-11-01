import { describe, expect, it } from "vitest";
import { COPILOT_TASKS, deterministicAnswer, requestScreen, retrieve, validateModelOutput } from "./copilot";
import { getResearchProject } from "./project";

const view = getResearchProject("freight", new Date("2026-11-01T12:00:00Z"))!;
const ids = new Set(view.evidence.map((e) => e.id));

describe("retrieval", () => {
  it("ranks evidence that matches the question", () => {
    const hits = retrieve(view.evidence, "diesel fuel surcharge", 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.slice(0, 3).some((e) => /fuel|diesel/i.test(e.claim))).toBe(true);
  });
});

describe("grounding validator", () => {
  it("moves uncited or invented-citation facts to unsupported", () => {
    const retrieved = ["EV-KPI-diesel"];
    const out = validateModelOutput(
      {
        facts: [
          { text: "Diesel rose sharply.", evidenceIds: ["EV-KPI-diesel"] },
          { text: "Spot rates rose 12%.", evidenceIds: [] },
          { text: "DAT says rates rose.", evidenceIds: ["EV-DAT-FAKE"] },
        ],
        calculations: [{ text: "x", evidenceIds: ["EV-KPI-diesel", "EV-NOT-RETRIEVED"] }],
        interpretation: [{ text: "Likely fuel-driven.", evidenceIds: ["EV-FAKE"] }],
      },
      retrieved,
    );
    expect(out.facts.map((f) => f.text)).toEqual(["Diesel rose sharply."]);
    expect(out.unsupported).toHaveLength(3);
    expect(out.interpretation[0].evidenceIds).toEqual([]);
  });
  it("tolerates garbage", () => {
    expect(validateModelOutput("nonsense", []).facts).toEqual([]);
  });
});

describe("deterministic copilot", () => {
  it("answers every task citing only existing evidence", () => {
    for (const task of COPILOT_TASKS) {
      const a = deterministicAnswer(view, { projectId: "freight", task: task.id, question: "fuel and rates", ticker: "KNX", text: "Loads are down 5%. Rates higher." });
      const all = [...a.facts, ...a.calculations, ...a.interpretation, ...a.hypotheses, ...a.missing];
      expect(all.length + a.followUps.length, task.id).toBeGreaterThan(0);
      for (const st of all) for (const id of st.evidenceIds) expect(ids.has(id), `${task.id} → ${id}`).toBe(true);
    }
  });
  it("labels interview guides as generated work product", () => {
    const a = deterministicAnswer(view, { projectId: "freight", task: "interview-guide", stakeholderId: "small-carrier" });
    expect(a.warnings.join(" ")).toMatch(/not evidence/);
  });
});

describe("request screening", () => {
  it("never sends possible MNPI or non-opted-in text to a model", () => {
    expect(requestScreen({ projectId: "freight", task: "notes-analysis", text: "Their results are not yet public", allowAi: true }).blockAi).toBe(true);
    expect(requestScreen({ projectId: "freight", task: "notes-analysis", text: "Rates are flat", allowAi: false }).blockAi).toBe(true);
    expect(requestScreen({ projectId: "freight", task: "notes-analysis", text: "Rates are flat", allowAi: true }).blockAi).toBe(false);
  });
});
