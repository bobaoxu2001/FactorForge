import "server-only";
import type { ResearchCase } from "@/data/events/types";
import { benchmarkSensitivity, caseAsOf, eventView, impacts, scoredForecasts, thesisViews, windowView } from "./view";
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

/** A claim stays a [citation]; a market check is named in words, because the memo links only claims. */
function refText(id: string): string {
  if (id.startsWith("MKT:")) return `the ${id.split(":")[2]} market check`;
  if (id.startsWith("EXP:")) return `the ${id.split(":")[1]} exposure entry`;
  if (id.startsWith("FIG:")) return "a company-disclosed figure";
  return `[${id}]`;
}

const withRefs = (text: string, refs: string[]) => (refs.length ? `${text} ${refs.map(refText).join(" ")}` : text);
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * The current assessment, written once in the case file and rendered here and
 * on the brief from the same record, so the two cannot drift apart.
 */
export function assessmentParagraphs(c: ResearchCase): string[] {
  const a = c.currentAssessment;
  if (!a) return [];
  return [
    `Current assessment, ${day(a.at)}. ${a.view}`,
    `Strength of this interpretation: ${a.interpretation.strength}. ${a.interpretation.reason}`,
    `Why it matters. ${a.whyItMatters}`,
    `Strongest evidence: ${a.strongest.map((x) => withRefs(x.text, x.refs)).join(" ")}`,
    `Key uncertainty: ${a.uncertainty.map((x) => withRefs(x.text, x.refs)).join(" ")}`,
    `Next verification step: ${a.nextStep}`,
    `What would change the view: ${a.wouldChange.map((x) => withRefs(x.text, x.refs)).join(" ")}`,
    ...(c.assessmentHistory ?? []).map((h) => `This replaces the assessment dated ${day(h.at)}, kept as history on the brief.`),
  ];
}

export function buildEventMemo(c: ResearchCase): MemoSection[] {
  const primary = eventView(c.primaryEventId);
  const sections: MemoSection[] = [];

  // 0. Current assessment (analyst, dated; shared with the brief)
  if (c.currentAssessment) sections.push({ title: "Current assessment", kind: "analyst", paragraphs: assessmentParagraphs(c) });

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
    const tested = v.studies.filter((s) => s.benchmark && s.windows[0]?.tStat != null);
    const sig = tested.filter((s) => s.windows[0].significant);
    const day0 = v.studies.find((s) => s.day0)?.day0 ?? "n/a";
    const sensitivity = benchmarkSensitivity(v);
    const ewText = sensitivity && v.day0TestsEqualWeight.significant !== v.day0Tests.significant ? ` ${sensitivity}` : "";
    const names = list(sig.map((s) => `${s.symbol} ${p1(s.windows[0].abnormal!)} vs ${s.benchmark}`));
    const sigText = ewText
      ? sig.length
        ? `Against their own benchmarks, beyond noise (both the t-test and the placebo rank): ${names}.`
        : ""
      : sig.length
        ? `Moves beyond what the benchmark explains (both the t-test and the placebo rank): ${names}. That is ${sig.length} of ${tested.length} tests, where chance alone would produce about ${v.day0Tests.expectedByChance.toFixed(1)}.`
        : `No instrument moved significantly more than its benchmark explains (${tested.length} tested).`;
    const overlap = v.overlaps["[0,4]"]?.length ? ` The five-session window overlaps ${list(v.overlaps["[0,4]"].map((o) => `"${o.title}" (${o.date})`))}, so multi-day figures mix events.` : "";
    marketParas.push(`${w.label}. Day 0: ${day0}. ${sigText}${ewText}${overlap}`.replace(/\s+/g, " ").trim());
  }
  marketParas.push(
    "These are associations around a date, not proof that the event caused the move. Abnormal returns use a market model fitted on 120 sessions ending ten sessions before day 0; a move counts only if its t-statistic (with estimation error) and its rank among the asset's own previous 500 sessions both say it is unusual. US stocks are measured against their own benchmark and against the equal-weight S&P 500; where the two disagree, the finding is benchmark-sensitive.",
  );
  sections.push({ title: "How the event reached markets", kind: "data", paragraphs: marketParas });

  // 4. Competing explanations
  if (primary?.event.competingExplanations.length) {
    sections.push({
      title: "Competing explanations",
      kind: "data",
      paragraphs: primary.event.competingExplanations.map((x) => {
        const forText = x.supportedBy.map(refText).join(" ") || "nothing recorded";
        const inconclusive = x.inconclusive?.length
          ? ` Inconclusive: ${x.inconclusive.map(refText).join(" ")}, with no statistically distinguishable move under the current benchmark and model, which neither supports nor rules it out.`
          : "";
        return `${x.label} (${x.epistemic === "CAUSAL_HYPOTHESIS" ? "hypothesis" : x.epistemic.toLowerCase()}): ${x.summary} For: ${forText}. Against: ${x.challengedBy.map(refText).join(" ") || "nothing recorded yet"}.${inconclusive}`;
      }),
    });
  }

  // 5. Exposure
  const imp = impacts(c);
  const byNet = (n: string) => imp.filter((i) => i.net === n).map((i) => i.ticker ?? i.label);
  sections.push({
    title: "Who is exposed",
    kind: "data",
    paragraphs: [
      `A link on the impact map counts evidence only when that evidence was available by ${day(caseAsOf(c))} and an analyst has judged it to bear on the link itself; evidence that only establishes a background fact, such as that a permit pause exists, leaves the link an assumption. Evidence-backed direction: negative for ${list(byNet("negative")) || "none"}; positive for ${list(byNet("positive")) || "none"}; ambiguous for ${list(byNet("ambiguous")) || "none"}. ${n(byNet("unsupported").length, "company has", "companies have")} no evidence-backed path yet.`,
      "The map's hypotheses concern revenue and earnings over months, so a one-day price move cannot confirm or refute them; measured price responses are reported beside the map, not as tests of it.",
    ],
  });

  // 5b. Company example
  for (const cc of c.companyCases ?? []) {
    const channels = cc.channels.map((ch) => `${ch.channel.replace(/-/g, " ")}: ${ch.read}`);
    sections.push({
      title: `Company example: ${cc.company}`,
      kind: "analyst",
      paragraphs: [
        `${cc.question} ${cc.whyThisCompany}`,
        ...(cc.revisions ?? []).map((r) => `Revised ${day(r.at)}: ${r.note}`),
        cc.exposureNote,
        `Channels, read as of ${day(cc.at)}. ${channels.join(" ")}`,
        cc.expectationGap.reference ? `Expectation gap against ${cc.expectationGap.reference}: ${cc.expectationGap.gap}` : cc.expectationGap.note,
        `Unknown: ${cc.unknowns.join(" ")}`,
        `Next research action: ${cc.nextAction}`,
      ],
    });
  }

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
