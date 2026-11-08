// @vitest-environment node
import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import forecastLedger from "@/data/events/forecast-ledger.json";
import thesisLedger from "@/data/events/thesis-ledger.json";
import { RESEARCH_CASES } from "@/data/events";
import { applyFamily, summarize, walkForward } from "./evaluation";
import { HORIZONS, MODEL_VERSION, predict, type ForecastRecord, type Horizon } from "./forecast";
import { appendRecord, verifyChain } from "./ledger";
import { barCloseInstant } from "./time";
import { ALL_THESES, EVALUATED_SYMBOLS, benchmarkOf, instrumentKindCost, series, thesisContentHash } from "./view";

/**
 * Ledger writer. Skipped in normal test runs; `npm run events:forecast` sets
 * EVENTS_WRITE_LEDGER=1 to append any planned forecast or thesis not yet in
 * the ledgers. It only ever appends: existing records are left byte-for-byte
 * alone, and the chain is verified before and after.
 *
 * It runs under Vitest so it can use the typed domain code without adding a
 * TypeScript runner to the project.
 */

const WRITE = process.env.EVENTS_WRITE_LEDGER === "1";

function nextBarDate(date: string, calendar: "us-equity" | "crypto-utc"): string {
  const d = new Date(`${date}T00:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (calendar === "us-equity" && (d.getUTCDay() === 0 || d.getUTCDay() === 6));
  return d.toISOString().slice(0, 10);
}

/**
 * Direction gate for one cutoff: every instrument in any plan × every horizon
 * is tested with data to the cutoff, and the family is Holm-corrected together,
 * so adding instruments makes the bar stricter, not looser.
 */
const gateCache = new Map<string, Map<string, boolean>>();
function directionGate(cutoff: string): Map<string, boolean> {
  if (gateCache.has(cutoff)) return gateCache.get(cutoff)!;
  const symbols = [...new Set([...EVALUATED_SYMBOLS(), ...RESEARCH_CASES.flatMap((c) => c.forecastPlans.flatMap((p) => p.instruments))])];
  const raw = symbols.flatMap((symbol) => {
    const asset = series(symbol);
    if (!asset) return [];
    const bench = series(benchmarkOf(symbol));
    return HORIZONS.map((h: Horizon) => summarize(symbol, h, walkForward(asset, bench, bench ?? asset, h, 5, cutoff)));
  });
  const gate = new Map(applyFamily(raw).map((s) => [`${s.instrument}:${s.horizon}`, s.directionValidated]));
  gateCache.set(cutoff, gate);
  return gate;
}

describe.skipIf(!WRITE)("ledger writer", () => {
  it("appends planned forecasts and new theses", () => {
    const now = new Date();
    const forecasts = [...(forecastLedger as unknown as ForecastRecord[])];
    expect(verifyChain(forecasts).ok).toBe(true);
    const have = new Set(forecasts.map((f) => f.id));

    for (const c of RESEARCH_CASES) {
      for (const plan of c.forecastPlans) {
        for (const symbol of plan.instruments) {
          for (const horizon of plan.horizons) {
            const asset = series(symbol);
            if (!asset) throw new Error(`no prices for ${symbol}`);
            const cutoff = plan.informationCutoff === "latest" ? asset.dates.at(-1)! : plan.informationCutoff;
            const id = `F-${cutoff}-${symbol}-${horizon}`;
            if (have.has(id)) continue;
            const benchmark = benchmarkOf(symbol);
            const bench = series(benchmark);
            // Validation uses only data up to the cutoff, like the forecast itself, and is corrected across the family.
            const directionValidated = directionGate(cutoff).get(`${symbol}:${horizon}`) ?? false;
            const spec = { instrument: symbol, benchmark, horizon, informationCutoff: cutoff, directionValidated };
            const { dataAsOf, prediction } = predict(spec, asset, bench);
            const firstTargetClose = dataAsOf ? barCloseInstant(nextBarDate(dataAsOf, asset.calendar), asset.calendar) : 0;
            const record: Omit<ForecastRecord, "hash" | "prevHash"> = {
              id,
              ...spec,
              createdAt: now.toISOString(),
              dataAsOf,
              calendar: asset.calendar,
              modelVersion: MODEL_VERSION,
              origin: now.getTime() < firstTargetClose ? "live" : "backfill",
              eventId: c.primaryEventId,
              thesisId: plan.thesisId,
              costBps: instrumentKindCost(symbol),
              prediction,
            };
            forecasts.push(appendRecord(forecasts, record) as ForecastRecord);
            have.add(id);
          }
        }
      }
    }
    expect(verifyChain(forecasts).ok).toBe(true);
    writeFileSync(path.join(process.cwd(), "src/data/events/forecast-ledger.json"), `${JSON.stringify(forecasts, null, 1)}\n`);

    const theses = [...(thesisLedger as unknown as Array<{ id: string; recordedAt: string; contentHash: string; hash: string; prevHash: string }>)];
    expect(verifyChain(theses).ok).toBe(true);
    for (const t of ALL_THESES) {
      if (theses.some((x) => x.id === t.id)) continue;
      theses.push(appendRecord(theses, { id: t.id, recordedAt: now.toISOString(), contentHash: thesisContentHash(t) }) as (typeof theses)[number]);
    }
    expect(verifyChain(theses).ok).toBe(true);
    writeFileSync(path.join(process.cwd(), "src/data/events/thesis-ledger.json"), `${JSON.stringify(theses, null, 1)}\n`);
  }, 120_000);
});
