import instrumentsConfig from "./instruments.json";
import { AI_DATACENTER_CASE } from "./cases/aiDatacenter";
import { BINANCE_CASE } from "./cases/binance";
import type { ResearchCase } from "./types";
import type { Claim, EventRecord, SourceRecord } from "@/lib/events/types";

/** Registry of event research cases. Add a case file and list it here. */
export const RESEARCH_CASES: ResearchCase[] = [AI_DATACENTER_CASE, BINANCE_CASE];

export const caseBySlug = (slug: string) => RESEARCH_CASES.find((c) => c.slug === slug) ?? null;
export const caseById = (id: string) => RESEARCH_CASES.find((c) => c.id === id) ?? null;

export const ALL_EVENTS: EventRecord[] = RESEARCH_CASES.flatMap((c) => c.events);
export const ALL_CLAIMS: Claim[] = RESEARCH_CASES.flatMap((c) => c.claims);
export const ALL_SOURCES: SourceRecord[] = RESEARCH_CASES.flatMap((c) => c.sources);

export const caseOfEvent = (eventId: string) => RESEARCH_CASES.find((c) => c.events.some((e) => e.id === eventId)) ?? null;

export interface InstrumentConfig {
  symbol: string;
  name: string;
  kind: "etf" | "index" | "equity" | "crypto";
  group: string;
  benchmark: string | null;
}

export const INSTRUMENTS: InstrumentConfig[] = (instrumentsConfig as { instruments: InstrumentConfig[] }).instruments;
export const instrument = (symbol: string) => INSTRUMENTS.find((i) => i.symbol === symbol) ?? null;
