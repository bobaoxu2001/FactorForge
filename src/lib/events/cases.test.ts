// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_CLAIMS, ALL_SOURCES, INSTRUMENTS, RESEARCH_CASES } from "@/data/events";
import { returnOn } from "./market";
import { parseInstant } from "./time";
import { validateCase } from "./verification";
import { SNAPSHOT, priceSeries, series } from "./view";

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
    const built = parseInstant(SNAPSHOT.builtAt);
    for (const s of ALL_SOURCES) expect(parseInstant(s.retrievedAt), s.id).toBeLessThanOrEqual(built);
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

  it("QCOM −9.5% on 5 Nov matches the reported move (A-C18), though the reason is unverified", () => {
    expect(pct("QCOM", "2026-11-05")).toBeCloseTo(-0.095, 3);
  });
});

describe("snapshot run log", () => {
  it("records a status for every instrument and every benchmark priced", () => {
    expect(SNAPSHOT.missingRequired).toEqual([]);
    for (const i of INSTRUMENTS) expect(SNAPSHOT.runLog.some((r) => r.symbol === i.symbol && r.step === "prices"), i.symbol).toBe(true);
  });
});
