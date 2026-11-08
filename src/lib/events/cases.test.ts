// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_CLAIMS, ALL_SOURCES, INSTRUMENTS, RESEARCH_CASES } from "@/data/events";
import { returnOn } from "./market";
import { parseInstant } from "./time";
import { validateCase, verifyClaim } from "./verification";
import { SNAPSHOT, priceSeries, series, windowView } from "./view";

describe("case data integrity", () => {
  it("passes validation with no errors", () => {
    for (const c of RESEARCH_CASES) expect(validateCase(c.events, c.claims, c.sources), c.id).toEqual([]);
  });

  it("uses unique ids across cases", () => {
    const ids = [...ALL_CLAIMS.map((c) => c.id), ...ALL_SOURCES.map((s) => s.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every unread source a reason and lets it support nothing on its own", () => {
    for (const s of ALL_SOURCES.filter((x) => x.retrieval !== "read")) {
      expect(s.retrievalNote, s.id).toBeTruthy();
      const onlyThis = ALL_CLAIMS.filter((c) => c.citations.every((x) => x.sourceId === s.id));
      expect(onlyThis, s.id).toEqual([]);
    }
  });

  it("never records a retrieval from the future", () => {
    // The platform's latest recorded moment: the market snapshot, or a later
    // dated assessment for which a primary document was read. Neither may lie
    // in the future.
    const assessed = RESEARCH_CASES.flatMap((c) => [c.currentAssessment?.at, ...(c.companyCases ?? []).map((x) => x.at)]).filter((x): x is string => !!x);
    const latest = Math.max(parseInstant(SNAPSHOT.builtAt), ...assessed.map((x) => parseInstant(x)));
    expect(latest).toBeLessThanOrEqual(Date.now());
    for (const s of ALL_SOURCES) expect(parseInstant(s.retrievedAt), s.id).toBeLessThanOrEqual(latest);
  });

  it("keeps verbatim excerpts out of the case files (paraphrase only)", () => {
    for (const c of ALL_CLAIMS) for (const x of c.citations) expect(x.says.length, c.id).toBeLessThan(220);
  });
});

describe("entity mapping", () => {
  it("does not invent a ticker for unlisted entities", () => {
    for (const c of RESEARCH_CASES) for (const e of c.events) for (const ent of e.entities) if (!ent.listed) expect(ent.ticker, ent.name).toBeUndefined();
    const binance = RESEARCH_CASES.flatMap((c) => c.events).flatMap((e) => e.entities).find((e) => e.name === "Binance")!;
    expect(binance.listed).toBe(false);
  });

  it("maps every case instrument, exposure and graph company to a priced instrument", () => {
    const known = new Set(INSTRUMENTS.map((i) => i.symbol));
    const priced = priceSeries();
    for (const c of RESEARCH_CASES) {
      const symbols = [
        ...c.events.flatMap((e) => e.instruments),
        ...c.windows.flatMap((w) => w.symbols),
        ...c.exposures.map((x) => x.ticker),
        ...c.graph.nodes.filter((n) => n.ticker).map((n) => n.ticker!),
        ...c.watchlist.flatMap((w) => w.symbols),
      ];
      for (const s of symbols) {
        expect(known.has(s), `${c.id}: ${s} not in instruments.json`).toBe(true);
        expect(priced.has(s), `${c.id}: ${s} not priced`).toBe(true);
      }
    }
  });

  it("keeps the snapshot script and the app on one instrument list", () => {
    const script = readFileSync(path.join(process.cwd(), "scripts/build-event-snapshot.mjs"), "utf8");
    expect(script).toContain('"src", "data", "events", "instruments.json"');
  });
});

describe("typed market statements agree with the data", () => {
  const pct = (sym: string, date: string) => returnOn(series(sym)!, date)!;

  it("Nasdaq Composite −5.5% on 5 Nov (A-C14)", () => {
    expect(pct("^IXIC", "2026-11-05")).toBeCloseTo(-0.0552, 3);
  });

  it("S&P 500 −4.4% on 5 Nov via SPY (A-C15)", () => {
    expect(pct("SPY", "2026-11-05")).toBeCloseTo(-0.044, 2);
  });

  it("NVDA −9.3%, AMD −17.3%, SMH −11.2%, XLU −0.7% on 5 Nov (A-C17)", () => {
    expect(pct("NVDA", "2026-11-05")).toBeCloseTo(-0.093, 3);
    expect(pct("AMD", "2026-11-05")).toBeCloseTo(-0.173, 3);
    expect(pct("SMH", "2026-11-05")).toBeCloseTo(-0.112, 3);
    expect(pct("XLU", "2026-11-05")).toBeCloseTo(-0.007, 3);
  });

  it("partial rebound on 6 Nov (A-C26)", () => {
    expect(pct("^IXIC", "2026-11-06")).toBeCloseTo(0.011, 3);
    expect(pct("SMH", "2026-11-06")).toBeCloseTo(0.036, 3);
    expect(pct("AMD", "2026-11-06")).toBeCloseTo(0.11, 3);
  });

  it("QCOM −9.5% on 5 Nov (A-C29); the reported miss behind it (A-C18) is unverified", () => {
    expect(pct("QCOM", "2026-11-05")).toBeCloseTo(-0.095, 3);
  });
});

describe("snapshot run log", () => {
  it("records a status for every instrument and every benchmark priced", () => {
    expect(SNAPSHOT.missingRequired).toEqual([]);
    for (const i of INSTRUMENTS) expect(SNAPSHOT.runLog.some((r) => r.symbol === i.symbol && r.step === "prices"), i.symbol).toBe(true);
  });
});

describe("reported, observed and hypothesized stay apart (Qualcomm, 5 Nov)", () => {
  const now = Date.parse(SNAPSHOT.builtAt);
  const claim = (id: string) => verifyClaim(ALL_CLAIMS.find((c) => c.id === id)!, ALL_SOURCES, now)!;

  it("keeps the price move as an observed fact and the miss as an unverified report", () => {
    expect(claim("A-C29").epistemic).toBe("OBSERVED_FACT");
    expect(claim("A-C29").verification).toBe("CONFIRMED");
    expect(claim("A-C18").epistemic).toBe("REPORTED_CLAIM");
    expect(claim("A-C18").verification).toBe("RUMOR");
    expect(claim("A-C18").statement).not.toMatch(/\b(after|because|due to)\b/);
    expect(claim("A-C18").corrections?.length).toBeGreaterThan(0);
  });

  it("lists QCOM's non-significant move as inconclusive for the earnings explanation, neither for nor against", () => {
    const ai = RESEARCH_CASES.find((c) => c.slug === "ai-datacenter-shock")!;
    const x = ai.events.flatMap((e) => e.competingExplanations).find((e) => e.id === "X-A2")!;
    expect(x.epistemic).toBe("CAUSAL_HYPOTHESIS");
    expect(x.supportedBy).not.toContain("MKT:W-A-SELL:QCOM");
    expect(x.challengedBy).not.toContain("MKT:W-A-SELL:QCOM");
    expect(x.inconclusive).toContain("MKT:W-A-SELL:QCOM");
  });
});

describe("competing explanations", () => {
  const explanations = RESEARCH_CASES.flatMap((c) => [...c.events.flatMap((e) => e.competingExplanations), ...(c.companyCases ?? []).flatMap((cc) => cc.tests)].map((x) => ({ c, x })));
  const check = (c: (typeof RESEARCH_CASES)[number], ref: string) => {
    const [, windowId, symbol] = ref.split(":");
    const v = windowView(c, windowId)!;
    return { own: v.studies.find((s) => s.symbol === symbol)!.windows[0], ew: v.equalWeight[symbol]?.windows[0] };
  };

  it("are worded as hypotheses, not established causes", () => {
    for (const { x } of explanations) {
      if (x.epistemic !== "CAUSAL_HYPOTHESIS") continue;
      expect(x.summary, x.id).not.toMatch(/\b(drove|drives|caused|because|absorbs|is market-wide)\b/);
    }
  });

  it("keep premises (facts the hypothesis starts from) out of the evidence that tests it", () => {
    for (const { x } of explanations) for (const id of x.premise ?? []) expect([...x.supportedBy, ...x.challengedBy], `${x.id} ${id}`).not.toContain(id);
  });

  it("tie every planned channel check to a hypothesis that exists, and keep it planned", () => {
    for (const c of RESEARCH_CASES) {
      const ids = new Set(explanations.filter((e) => e.c === c).map((e) => e.x.id));
      for (const k of c.channelChecks ?? []) {
        expect(k.status, k.id).toBe("planned");
        for (const t of k.tests) expect(ids.has(t), `${k.id} ${t}`).toBe(true);
      }
    }
  });

  it("cite a market check for or against only when it passed both significance checks; a null result is inconclusive", () => {
    for (const { c, x } of explanations) {
      for (const ref of [...x.supportedBy, ...x.challengedBy].filter((r) => r.startsWith("MKT:"))) expect(check(c, ref).own?.significant, `${x.id} ${ref}`).toBe(true);
      for (const ref of x.inconclusive ?? []) {
        const { own, ew } = check(c, ref);
        expect(own?.significant, `${x.id} ${ref}`).toBe(false);
        expect(ew?.significant ?? false, `${x.id} ${ref} vs RSP`).toBe(false);
      }
    }
  });
});

