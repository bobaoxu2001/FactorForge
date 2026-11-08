import { describe, expect, it } from "vitest";
import { ALL_CLAIMS, ALL_EVENTS, ALL_SOURCES } from "@/data/events";
import { canonicalUrl, countIndependent } from "./sources";
import { parseInstant, TimestampError } from "./time";
import type { Claim, SourceRecord } from "./types";
import { eventAsOf, quantityLedger, verifyClaim } from "./verification";

const NOW = Date.parse("2026-11-08T04:00:00Z");
const claim = (id: string) => ALL_CLAIMS.find((c) => c.id === id)!;
const view = (id: string, at = NOW) => verifyClaim(claim(id), ALL_SOURCES, at);

const src = (over: Partial<SourceRecord> & { id: string }): SourceRecord => ({
  title: over.id,
  publisher: over.id,
  url: `https://example.com/${over.id}`,
  tier: "independent-reporting",
  publishedAt: "2026-11-01T12:00:00Z",
  publishedPrecision: "minute",
  retrievedAt: "2026-11-02T00:00:00Z",
  retrieval: "read",
  ...over,
});
const mk = (citations: Claim["citations"], extra: Partial<Claim> = {}): Claim => ({
  id: "X",
  eventId: "E",
  statement: "s",
  epistemic: "REPORTED_CLAIM",
  topic: "t",
  citations,
  recordedAt: "2026-11-02T00:00:00Z",
  ...extra,
});

describe("contradictory sources", () => {
  it("marks a claim DISPUTED when closing data contradict a wire report", () => {
    const v = view("A-C16")!;
    expect(v.verification).toBe("DISPUTED");
    expect(v.verificationReason).toMatch(/Yahoo Finance/);
  });

  it("keeps the data-backed version of the same fact CONFIRMED", () => {
    expect(view("A-C17")!.verification).toBe("CONFIRMED");
  });

  it("lets an official first-hand source settle a contradiction", () => {
    const sources = [src({ id: "gov", tier: "primary-official" }), src({ id: "blog", tier: "secondary-aggregator" })];
    const c = mk([{ sourceId: "gov", says: "yes" }, { sourceId: "blog", says: "no", stance: "contradicts" }]);
    expect(verifyClaim(c, sources, NOW)!.verification).toBe("CONFIRMED");
  });
});

describe("rumours versus enacted regulation", () => {
  it("confirms an enactment only from an official source", () => {
    const ny = view("A-C01")!;
    expect(ny.verification).toBe("CONFIRMED");
    expect(ny.effectiveLifecycle).toBe("IMPLEMENTED");
  });

  it("treats an aggregator's 'already in force' as proposed until an official source confirms it", () => {
    const v = view("A-C07")!;
    expect(v.verification).toBe("RUMOR");
    expect(v.effectiveLifecycle).toBe("PROPOSED");
    expect(v.lifecycleGuard).toMatch(/no official source/);
  });

  it("never upgrades a campaign promise to enacted", () => {
    const v = view("A-C09")!;
    expect(v.verification).toBe("CORROBORATED");
    expect(v.effectiveLifecycle).toBe("PROPOSED");
  });
});

describe("one event reported by many outlets", () => {
  it("counts wire copies and AMP pages once", () => {
    const all = [
      src({ id: "ap", publisher: "Associated Press" }),
      src({ id: "yahoo", publisher: "Yahoo Finance", originator: "Associated Press", url: "https://finance.yahoo.com/x" }),
      src({ id: "local", publisher: "Local Paper", republishes: "ap", url: "https://local.example/x" }),
      src({ id: "amp", publisher: "Fox 4", url: "https://www.fox4news.com/news/story.amp" }),
      src({ id: "fox", publisher: "Fox 4", url: "https://fox4news.com/news/story" }),
    ];
    expect(countIndependent(all.slice(0, 3), all)).toBe(1);
    expect(countIndependent(all, all)).toBe(2);
    expect(canonicalUrl("https://www.fox4news.com/news/story.amp")).toBe(canonicalUrl("https://fox4news.com/news/story/"));
  });

  it("does not let repeated copies corroborate a claim", () => {
    const all = [src({ id: "ap", publisher: "Associated Press" }), src({ id: "copy", publisher: "Yahoo", originator: "Associated Press" })];
    const c = mk([{ sourceId: "ap", says: "x" }, { sourceId: "copy", says: "x" }]);
    expect(verifyClaim(c, all, NOW)!.verification).toBe("REPORTED");
  });

  it("treats two versions of one CNBC article as one origin", () => {
    expect(view("B-C03")!.independentSupport).toBe(1);
  });
});

describe("attribution needs an official source read first-hand", () => {
  it("keeps the FBI attribution below CONFIRMED while the FBI page is unread", () => {
    const v = view("B-C19")!;
    expect(v.verification).toBe("CORROBORATED");
    expect(v.verificationReason).toMatch(/second-hand/);
  });

  it("does not let a blocked source support anything", () => {
    const blocked = [src({ id: "fbi", tier: "primary-official", retrieval: "blocked", retrievalNote: "403" })];
    expect(verifyClaim(mk([{ sourceId: "fbi", says: "x" }]), blocked, NOW)).toBeNull();
  });

  it("caps claims resting on unnamed sources at REPORTED", () => {
    expect(view("B-C22")!.verification).toBe("REPORTED");
  });
});

describe("timestamps", () => {
  it("rejects a timestamp without an offset", () => {
    expect(() => parseInstant("2026-10-29T17:05:00")).toThrow(TimestampError);
  });

  it("reads Brasília time correctly", () => {
    expect(new Date(parseInstant("2026-10-29T17:05:00-03:00")).toISOString()).toBe("2026-10-29T20:05:00.000Z");
  });
});

describe("hindsight protection", () => {
  it("hides claims that were not yet published at the cutoff", () => {
    const binance = ALL_EVENTS.find((e) => e.id === "EV-BINANCE-2026-10-29")!;
    const early = eventAsOf(binance, ALL_CLAIMS, ALL_SOURCES, "2026-10-30T23:00:00Z")!;
    const ids = early.claims.map((c) => c.id);
    expect(ids).toContain("B-C01");
    expect(ids).not.toContain("B-C02"); // the 3 Nov preliminary report
    expect(ids).not.toContain("B-C14"); // withdrawals resumed on 1 Nov
    expect(early.hiddenClaimCount).toBeGreaterThan(0);
  });

  it("dates first publication to the first report of the event, not to background sources", () => {
    const binance = ALL_EVENTS.find((e) => e.id === "EV-BINANCE-2026-10-29")!;
    const v = eventAsOf(binance, ALL_CLAIMS, ALL_SOURCES, "2026-11-08T04:00:00Z")!;
    expect(v.firstPublishedAt).toBe("2026-10-29T22:01:00.000Z"); // CNBC, 18:01 New York
  });

  it("returns nothing before the event happened", () => {
    const binance = ALL_EVENTS.find((e) => e.id === "EV-BINANCE-2026-10-29")!;
    expect(eventAsOf(binance, ALL_CLAIMS, ALL_SOURCES, "2026-10-29T12:00:00Z")).toBeNull();
  });

  it("dates a wire story to after the close it reports, not its earlier display time", () => {
    const ap = ALL_SOURCES.find((s) => s.id === "A-S3")!;
    expect(parseInstant(ap.publishedAt)).toBeGreaterThan(parseInstant("2026-11-05T16:00:00-05:00"));
  });
});

describe("frozen versus recovered", () => {
  it("keeps frozen, replenished and recovered on separate lines", () => {
    const binance = ALL_EVENTS.find((e) => e.id === "EV-BINANCE-2026-10-29")!;
    const v = eventAsOf(binance, ALL_CLAIMS, ALL_SOURCES, "2026-11-08T04:00:00Z")!;
    const [affected, frozen, replenished, recovered] = quantityLedger(v.claims, ["affected", "frozen", "replenished", "recovered"]);
    expect(affected.latest!.quantity.value).toBe(6.34e9);
    expect(frozen.latest!.claimId).toBe("B-C05");
    expect(frozen.latest!.quantity.value).toBe(2.85e9);
    expect(replenished.latest!.quantity.value).toBe(0.98);
    expect(recovered.latest).toBeNull(); // unknown, not zero and not the frozen figure
  });

  it("never adds issuer freezes into Binance's total", () => {
    const binance = ALL_EVENTS.find((e) => e.id === "EV-BINANCE-2026-10-29")!;
    const v = eventAsOf(binance, ALL_CLAIMS, ALL_SOURCES, "2026-11-08T04:00:00Z")!;
    const frozen = quantityLedger(v.claims, ["frozen"])[0];
    expect(frozen.latest!.quantity.value).not.toBe(2.85e9 + 1.5e9 + 8e8);
  });
});

describe("empty or insufficient evidence", () => {
  it("returns null for a claim with no usable source", () => {
    expect(verifyClaim(mk([]), [], NOW)).toBeNull();
  });

  it("calls an event confirmed by one interested party medium confidence at best", () => {
    const ny = ALL_EVENTS.find((e) => e.id === "EV-NY-MORATORIUM-2026-07-14")!;
    const v = eventAsOf(ny, ALL_CLAIMS, ALL_SOURCES, "2026-11-08T04:00:00Z")!;
    expect(v.verification).toBe("CONFIRMED");
    expect(v.confidence).toBe("medium");
  });
});
