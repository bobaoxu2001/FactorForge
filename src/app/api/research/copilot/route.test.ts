import { beforeEach, describe, expect, it, vi } from "vitest";

const deepseek = vi.hoisted(() => ({ configured: false, response: null as unknown }));
vi.mock("@/lib/ai/deepseek", () => ({
  isDeepseekConfigured: () => deepseek.configured,
  callDeepseekJson: vi.fn(async () => deepseek.response),
}));

import { POST } from "./route";
import { resetRateLimits } from "@/lib/ratelimit";

const call = (body: unknown, ip = "10.0.0.1") =>
  POST(new Request("http://localhost/api/research/copilot", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) }));

describe("POST /api/research/copilot", () => {
  beforeEach(async () => {
    deepseek.configured = false;
    deepseek.response = null;
    await resetRateLimits();
  });

  it("validates input", async () => {
    expect((await call({ projectId: "freight", task: "nope" })).status).toBe(400);
    expect((await call({ projectId: "nope", task: "question" })).status).toBe(404);
    expect((await call({ projectId: "freight", task: "question", question: "x".repeat(1001) })).status).toBe(400);
  });

  it("answers deterministically without a key, citing only real evidence", async () => {
    const res = await call({ projectId: "freight", task: "question", question: "diesel truckload pricing" });
    const body = await res.json();
    expect(body.source).toBe("deterministic");
    expect(body.origin).toBe("template-generated");
    expect(body.facts.length).toBeGreaterThan(0);
    const retrieved = new Set(body.retrieved.map((r: { id: string }) => r.id));
    for (const f of body.facts) for (const id of f.evidenceIds) expect(id).toMatch(/^EV-/);
    expect(retrieved.size).toBeGreaterThan(0);
  });

  it("strips model facts that cite nothing or cite evidence that was not retrieved", async () => {
    deepseek.configured = true;
    deepseek.response = {
      facts: [
        { text: "Diesel is up sharply year over year.", evidenceIds: ["EV-KPI-diesel"] },
        { text: "Spot rates rose 12% (DAT).", evidenceIds: ["EV-DAT-INVENTED"] },
        { text: "Brokers are losing share.", evidenceIds: [] },
      ],
      interpretation: [{ text: "Pricing looks fuel-led.", evidenceIds: [] }],
    };
    const body = await (await call({ projectId: "freight", task: "question", question: "diesel fuel price" })).json();
    expect(body.source).toBe("deepseek");
    expect(body.facts.map((f: { text: string }) => f.text)).toEqual(["Diesel is up sharply year over year."]);
    expect(body.unsupported).toHaveLength(2);
  });

  it("preserves computed evidence directions even when live AI is configured", async () => {
    deepseek.configured = true;
    deepseek.response = { facts: [{ text: "Contradicts H4: Werner margins declined", evidenceIds: ["EV-WERN-OM-2026-06-30"] }] };
    const body = await (await call({ projectId: "freight", task: "evidence-check", hypothesisId: "H4" })).json();
    expect(body.source).toBe("deterministic");
    expect(body.origin).toBe("template-generated");
    expect(body.facts.some((f: { text: string }) => f.text.includes("Direction consistent with H4") && f.text.includes("Werner"))).toBe(true);
    expect(body.facts.some((f: { text: string }) => f.text.includes("Contradicts H4: Werner"))).toBe(false);
    const retrieved = new Set(body.retrieved.map((r: { id: string }) => r.id));
    for (const row of [...body.facts, ...body.calculations]) for (const id of row.evidenceIds) expect(retrieved.has(id)).toBe(true);
  });

  it("never forwards notes with MNPI language to the model", async () => {
    deepseek.configured = true;
    deepseek.response = { facts: [] };
    const { callDeepseekJson } = await import("@/lib/ai/deepseek");
    vi.mocked(callDeepseekJson).mockClear();
    const body = await (await call({ projectId: "freight", task: "notes-analysis", text: "Their Q4 results are not yet public. Loads down 5%.", allowAi: true })).json();
    expect(callDeepseekJson).not.toHaveBeenCalled();
    expect(body.source).toBe("deterministic");
    expect(body.warnings.join(" ")).toMatch(/NOT sent to an AI model/);
  });

  it("rate-limits per client", async () => {
    process.env.COPILOT_RATE_LIMIT_PER_HOUR = "2";
    await call({ projectId: "freight", task: "follow-ups" }, "10.9.9.9");
    await call({ projectId: "freight", task: "follow-ups" }, "10.9.9.9");
    const third = await call({ projectId: "freight", task: "follow-ups" }, "10.9.9.9");
    expect(third.status).toBe(429);
    delete process.env.COPILOT_RATE_LIMIT_PER_HOUR;
  });
});
