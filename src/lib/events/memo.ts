import "server-only";
import type { ResearchCase } from "@/data/events/types";
import { eventView, impacts, scoredForecasts, thesisViews, windowView } from "./view";
import type { VerificationState } from "./types";

/**
 * Event research memo, assembled from the case's verified state. Each
 * paragraph is either "data" (generated from claims and measurements, so every
 * number traces to a claim or a computed market check) or "analyst" (the case
 * author's interpretation, labelled as such). Claims are cited inline as [ID].
 */

export interface MemoSection {
  title: string;
  kind: "data" | "analyst";
  paragraphs: string[];
}

const p1 = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)}%`;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function buildEventMemo(c: ResearchCase): MemoSection[] {
  const primary = eventView(c.primaryEventId);
  const sections: MemoSection[] = [];

  // 1. What happened
  if (primary) {
    sections.push({
      title: "What happened",
      kind: "data",
      paragraphs: [
        `${primary.event.summary} Verification of the core facts: ${primary.verification.toLowerCase()} [${primary.event.coreClaimIds.join("][")}]. ${primary.confidenceReason}`,
      ],
    });
  }

  // 2. Verified versus not
  const views = c.events.flatMap((e) => eventView(e.id)?.claims ?? []);
  const count = (s: VerificationState) => views.filter((v) => v.verification === s).length;
  const disputed = views.filter((v) => v.verification === "DISPUTED");
  const guarded = views.filter((v) => v.lifecycleGuard);
  const weak = views.filter((v) => (v.verification === "REPORTED" || v.verification === "RUMOR") && (v.topic === "What failed" || v.topic === "Attribution" || v.topic === "Drivers"));
  sections.push({
    title: "What is verified, and what is not",
    kind: "data",
    paragraphs: [
      `Of ${views.length} claims in this edition: ${count("CONFIRMED")} confirmed, ${count("CORROBORATED")} corroborated by independent reporting, ${count("REPORTED")} resting on a single report, ${count("RUMOR")} only on aggregators, and ${count("DISPUTED")} disputed. "Confirmed" for a company statement means the company said it, not that its substance was checked independently.`,
      ...(weak.length ? [`Still resting on one source or on aggregators: ${weak.map((w) => `[${w.id}]`).join(" ")}. These can frame questions but cannot support a conclusion.`] : []),
      ...(disputed.length ? [`Disputed: ${disputed.map((d) => `[${d.id}]`).join(" ")} — the sources disagree, and the platform shows both rather than choosing.`] : []),
      ...(guarded.length ? [`Lifecycle guard: ${guarded.map((g) => `[${g.id}]`).join(" ")} is described as in force, but no official source confirms it, so it is treated as proposed.`] : []),
    ],
  });

  // 3. Market transmission
  const marketParas: string[] = [];
  for (const w of c.windows) {
    const v = windowView(c, w.id);
    if (!v) continue;
    const sig = v.studies.filter((s) => s.benchmark && s.windows[0]?.tStat != null && Math.abs(s.windows[0].tStat!) >= 1.96);
    const quiet = v.studies.filter((s) => s.benchmark && s.windows[0]?.tStat != null && Math.abs(s.windows[0].tStat!) < 1.96);
    const day0 = v.studies.find((s) => s.day0)?.day0 ?? "n/a";
    const sigText = sig.length
      ? `Moves beyond what the benchmark explains (|t| ≥ 1.96): ${list(sig.map((s) => `${s.symbol} ${p1(s.windows[0].abnormal!)} vs ${s.benchmark}`))}.`
      : "No instrument moved significantly more than its benchmark explains.";
    const overlap = v.overlaps["[0,4]"]?.length ? ` The five-session window overlaps ${list(v.overlaps["[0,4]"].map((o) => `"${o.title}" (${o.date})`))}, so multi-day figures mix events.` : "";
    marketParas.push(`${w.label}. Day 0: ${day0}. ${sigText} ${n(quiet.length, "other instrument", "other instruments")} stayed within normal noise.${overlap}`);
  }
  marketParas.push("Abnormal returns use a market model fitted on 120 sessions ending ten sessions before day 0. When the affected stocks are a large part of the benchmark itself (AI names in QQQ), benchmark-adjusted figures understate the event's effect; read them alongside raw returns.");
  sections.push({ title: "How the event reached markets", kind: "data", paragraphs: marketParas });

  // 4. Competing explanations
  if (primary?.event.competingExplanations.length) {
    sections.push({
      title: "Competing explanations",
      kind: "data",
      paragraphs: primary.event.competingExplanations.map((x) => {
        const claimsFor = x.supportedBy.filter((id) => !id.startsWith("MKT:"));
        const marketFor = x.supportedBy.length - claimsFor.length;
        const forText = claimsFor.length ? claimsFor.map((id) => `[${id}]`).join(" ") + (marketFor ? " plus market checks" : "") : marketFor ? "market checks only" : "nothing recorded";
        return `${x.label} (${x.epistemic === "CAUSAL_HYPOTHESIS" ? "hypothesis" : x.epistemic.toLowerCase()}): ${x.summary} For: ${forText}. Against: ${x.challengedBy.map((id) => `[${id}]`).join(" ") || "nothing recorded yet"}.`;
      }),
    });
  }

  // 5. Exposure
  const imp = impacts(c);
  const byNet = (n: string) => imp.filter((i) => i.net === n).map((i) => i.ticker ?? i.label);
  const contradicted = imp.filter((i) => i.marketCheck === "contradicted");
  sections.push({
    title: "Who is exposed",
    kind: "data",
    paragraphs: [
      `On evidence-backed paths of the impact map: negative for ${list(byNet("negative")) || "none"}; positive for ${list(byNet("positive")) || "none"}; ambiguous (paths disagree) for ${list(byNet("ambiguous")) || "none"}. Paths that rest only on hypotheses are shown on the map but do not set a direction.`,
      contradicted.length
        ? `Measured reactions contradict the map for ${list(contradicted.map((i) => i.ticker ?? i.label))}; the map does not override the data.`
        : "No measured day-0 reaction contradicts the map's direction.",
    ],
  });

  // 6. Scenarios
  sections.push({
    title: "Scenarios",
    kind: "analyst",
    paragraphs: [
      ...c.scenarios.map((s) => `${s.case[0].toUpperCase()}${s.case.slice(1)} — ${s.title}: ${s.narrative} Invalidated by: ${s.invalidation.join(" ")}`),
      "No probabilities are attached: no model here is calibrated for event-conditional outcomes. Measured volatility ranges are on the scenarios page.",
    ],
  });

  // 7. Theses
  const theses = thesisViews().filter((t) => t.replay.thesis.caseId === c.id);
  sections.push({
    title: "Theses and what would change them",
    kind: "data",
    paragraphs: theses.map((t) => {
      const last = t.replay.revisions.filter((r) => r.fired.length).at(-1);
      const pending = t.replay.pendingTriggers.map((x) => x.description);
      return `${t.replay.thesis.title} (${t.replay.thesis.origin}, now ${t.replay.status.replace("_", " ").toLowerCase()}). ${last ? `Last change: ${last.explanation}` : "No trigger has fired."} Still watching for: ${pending.join("; ") || "nothing"}.${t.outcome.state === "right" || t.outcome.state === "wrong" ? ` Outcome: ${t.outcome.state}. ${t.outcome.detail}` : ""}`;
    }),
  });

  // 8. Forecast record
  const fc = scoredForecasts().filter((f) => f.record.eventId && c.events.some((e) => e.id === f.record.eventId));
  const scored = fc.filter((f) => f.score.status === "scored");
  const inside = scored.filter((f) => f.score.inInterval).length;
  const calls = fc.filter((f) => f.record.prediction.direction !== "ABSTAIN");
  sections.push({
    title: "Forecast record",
    kind: "data",
    paragraphs: [
      `${fc.length} forecasts are on the ledger for this case (${fc.filter((f) => f.record.origin === "live").length} live, ${fc.filter((f) => f.record.origin === "backfill").length} backfilled). ${scored.length} have realized; ${inside} of them landed inside their 80% range. ${calls.length} made a directional call; the rest abstained because no directional skill was shown out of sample.`,
    ],
  });

  // 9. Analyst notes
  sections.push({ title: "Analyst notes", kind: "analyst", paragraphs: c.memo.map((m) => `${m.heading}. ${m.body}`) });

  // 10. Open questions and limitations
  sections.push({
    title: "Open questions and limitations",
    kind: "data",
    paragraphs: [...c.events.flatMap((e) => e.openQuestions), ...c.limitations],
  });

  return sections;
}
