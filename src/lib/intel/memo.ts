import { pct } from "@/lib/utils/format";
import { ordinal, scenarioResults, type CompanyView } from "./companies";
import { pp } from "./evidence";
import type { ResearchProjectView } from "./project";
import { MEMO_STATUS_LABEL } from "./quality";
import type { HypothesisView, MemoSection, MemoStatus, TestOutcome } from "./types";

/**
 * Research memo assembly. Every sentence that states a number is generated
 * from the project view and cites the evidence it came from as [EV-…], so the
 * memo can be traced claim → source in the Evidence Explorer. Sections whose
 * inputs do not exist (e.g., consensus estimates) say so instead of guessing.
 */

const cite = (...ids: Array<string | undefined | null>) => {
  const clean = ids.filter((id): id is string => Boolean(id));
  return clean.length ? ` [${clean.join(", ")}]` : "";
};

const OUTCOME_WORD: Record<TestOutcome, string> = {
  supports: "supported",
  contradicts: "contradicted",
  mixed: "mixed",
  "insufficient-data": "untested (insufficient data)",
};

const usd = (v: number | null | undefined, unit: "M" | "B" = "M") =>
  v === null || v === undefined || !Number.isFinite(v) ? "n/a" : `$${(v / (unit === "B" ? 1e9 : 1e6)).toLocaleString("en-US", { maximumFractionDigits: unit === "B" ? 2 : 0 })}${unit}`;

const x = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "n/m" : `${v.toFixed(1)}×`);

function hyp(view: ResearchProjectView, id: string): HypothesisView | undefined {
  return view.hypotheses.find((h) => h.id === id);
}

function kpiLine(view: ResearchProjectView, id: string): string | null {
  const k = view.kpis.find((v) => v.kpi.id === id);
  if (!k?.latest || k.latest.yoy === null) return null;
  return `${k.kpi.name} ${pct(k.latest.yoy)} YoY (${k.latest.date.slice(0, 7)})${cite(`EV-KPI-${id}`)}`;
}

/**
 * Drop citations to evidence that does not exist (e.g., a valuation item for a
 * company whose EV/EBITDA is unavailable). A memo must never cite a phantom.
 */
export function sanitizeCitations(text: string, known: Set<string>): string {
  return text
    .replace(/\s*\[([^\]]*)\]/g, (match, inner: string) => {
      if (!/EV-/.test(inner)) return match;
      const kept = inner.split(",").map((id) => id.trim()).filter((id) => known.has(id));
      return kept.length ? ` [${kept.join(", ")}]` : "";
    })
    .trim();
}

/** Variant view, derived from test outcomes, never typed in. */
export function variantView(view: ResearchProjectView): string[] {
  const known = new Set(view.evidence.map((e) => e.id));
  return rawVariantView(view).map((p) => sanitizeCitations(p, known));
}

function rawVariantView(view: ResearchProjectView): string[] {
  const h1 = hyp(view, "H1");
  const h2 = hyp(view, "H2");
  const h3 = hyp(view, "H3");
  const h5 = hyp(view, "H5");
  const h6 = hyp(view, "H6");
  const tl = view.residuals.find((r) => r.kpiId === "ppi-truckload");
  const out: string[] = [];
  const priceHeadline = h2?.tests.find((t) => t.id === "H2-T1");
  const exFuel = h2?.tests.find((t) => t.id === "H2-T2");
  if (priceHeadline?.outcome === "supports" && exFuel?.outcome === "contradicts" && tl?.latest) {
    out.push(
      `Headline truckload PPI is rising (${pct(tl.latest.actual)} YoY), but is ${Math.abs(tl.latest.residual * 100).toFixed(1)}pp below the YoY change implied by its historical diesel sensitivity${cite("EV-CALC-ppi-truckload-FUEL")}. Working view: this weakens the case for a broad underlying rate recovery. The residual does not isolate fuel-surcharge pass-through; volume, freight mix and contract-reset timing are competing explanations.${tl.extrapolation ? " Diesel's YoY move is outside the model's training range, which reduces confidence in this signal." : ""} Sustained gains in matched ex-fuel spot and contract rates would challenge this view; shipment volumes would help distinguish demand-led recovery from capacity-driven pricing. Those rate feeds are not connected.`,
    );
  } else if (exFuel?.outcome === "supports" && tl?.latest) {
    out.push(`Truckload PPI's YoY change is ${pp(tl.latest.residual)} above the change implied by its historical diesel sensitivity${cite("EV-CALC-ppi-truckload-FUEL")}. This is consistent with firmer underlying rates, but the residual also captures freight mix, contract timing and model error. Confirm it against matched ex-fuel rate and shipment-volume data before treating it as a rate recovery.${tl.extrapolation ? " Diesel's YoY move is outside the model's training range, which reduces confidence in this signal." : ""}`);
  }
  if (h1) {
    out.push(
      h1.overall === "supports"
        ? `Volume measures agree on a year-over-year upturn${cite(...h1.supportingEvidenceIds.slice(0, 3))}.`
        : h1.overall === "contradicts"
          ? `Volume measures are still declining${cite(...h1.contradictingEvidenceIds.slice(0, 3))}.`
          : `Volume evidence is flat to mixed: ${[kpiLine(view, "truck-tonnage"), kpiLine(view, "cass-shipments"), kpiLine(view, "freight-tsi")].filter(Boolean).join("; ")}. This does not yet confirm a demand-led recovery.`,
    );
  }
  if (h3?.overall === "supports") out.push(`Truck-transportation payrolls suggest slow labour-capacity contraction${cite(...h3.supportingEvidenceIds.slice(0, 1))}. Payrolls exclude owner-operators and do not measure fleet capacity or utilisation directly. Check operating-authority exits, fleet counts and utilisation before inferring a tightening freight market.`);
  if (h5?.overall === "contradicts") {
    const periods = [...new Set(view.companies.map((c) => c.latest?.label).filter((label): label is string => Boolean(label)))];
    out.push(`Observed margin changes do not establish a broad asset-based truckload operating-leverage advantage${cite(...h5.contradictingEvidenceIds.slice(0, 3))}.${periods.length > 1 ? ` The peer table mixes ${periods.join(" and ")}, so the group comparison is provisional.` : ""} Company mix, acquisitions, fuel recovery and contract timing can affect the result. Re-run the comparison on matched quarters and segment-level operating metrics before attributing the differences to business model.`);
  }
  if (h6?.overall === "contradicts") out.push(`The H6 screens' elevated-valuation and relative-strength conditions are not jointly met${cite(...h6.contradictingEvidenceIds.slice(0, 4))}. Relative share-price returns and trailing valuation percentiles do not identify investor expectations. Earnings expectations, business mix and discount rates remain alternative explanations. Compare the recovery assumptions implied by the current price with forward earnings estimates before claiming a market expectations gap; no consensus estimates are connected.`);
  return out;
}

function companyParagraph(c: CompanyView): string {
  const row = c.latest;
  const angle = c.coverage.researchAngle;
  if (!row) return `${c.name} (${c.ticker}): no quarterly data in snapshot.`;
  return `${c.name} (${c.ticker}, ${c.coverage.businessModel}): ${row.label} revenue ${usd(row.revenue)} (${pct(row.revenueYoY ?? Number.NaN)} YoY)${cite(`EV-${c.ticker}-REV`)}, operating margin ${row.operatingMargin === null ? "n/a" : `${(row.operatingMargin * 100).toFixed(1)}%`} (${pp(row.operatingMarginYoYChange)} YoY)${cite(`EV-${c.ticker}-OM`)}. Open question: ${angle}`;
}

export function buildMemoSections(view: ResearchProjectView): MemoSection[] {
  const { config } = view;
  const focus = view.companies.filter((c) => c.coverage.focus);
  const sections: Array<Omit<MemoSection, "number">> = [];
  const add = (id: string, title: string, body: string[], evidenceIds: string[] = [], limitation?: string) =>
    sections.push({ id, title, body, evidenceIds, limitation });

  const summary = view.hypotheses.map((h) => `${h.id} ${h.title}: ${OUTCOME_WORD[h.overall]}`).join("; ");
  add("executive-summary", "Executive Summary", [
    `Status: ${MEMO_STATUS_LABEL[view.memoStatus]}. As of ${view.asOf}; data snapshot built ${view.snapshot.builtAt.slice(0, 10)}.`,
    ...variantView(view).slice(0, 3),
    `Hypothesis scorecard: ${summary}.`,
  ]);

  add(
    "industry-background",
    "Industry Background",
    view.marketStructure.flatMap((s) => [`${s.heading}: ${s.points.join(" ")}${cite(...s.evidenceIds.slice(0, 3))}`]),
    view.marketStructure.flatMap((s) => s.evidenceIds),
  );

  add("company-overview", "Company Overview", focus.map(companyParagraph), focus.flatMap((c) => [`EV-${c.ticker}-REV`, `EV-${c.ticker}-OM`]));

  add("investment-question", "Core Investment Question", [config.researchQuestion]);

  add(
    "market-narrative",
    "Consensus / Market Narrative",
    [
      "No licensed consensus estimates are connected, so this section describes the narratives being tested and what prices show. It does not claim to know sell-side consensus.",
      ...view.hypotheses.map((h) => `${h.id}: ${h.marketNarrative}`),
      ...focus.map((c) => {
        const ps = c.priceStats;
        return ps && ps.relativeReturn6m !== null ? `${c.ticker} six-month total return ${pct(ps.return6m ?? Number.NaN)} vs SPY ${pct(ps.marketReturn6m ?? Number.NaN)}${cite(`EV-${c.ticker}-RET`)}.` : `${c.ticker}: price history unavailable.`;
      }),
    ],
    focus.map((c) => `EV-${c.ticker}-RET`),
    "Consensus estimates require a licensed data provider.",
  );

  add("variant-view", "Differentiated or Variant View", variantView(view));

  const evidenceLine = (id: string) => {
    const e = view.evidence.find((v) => v.id === id);
    return e ? `${e.claim} [${e.id}]` : null;
  };
  add(
    "supporting-evidence",
    "Supporting Evidence",
    view.hypotheses.flatMap((h) => h.supportingEvidenceIds.slice(0, 4).map((id) => `${h.id}: ${evidenceLine(id)}`)).filter((l) => !l.endsWith("null")),
    view.hypotheses.flatMap((h) => h.supportingEvidenceIds),
  );
  add(
    "contradictory-evidence",
    "Contradictory Evidence",
    view.hypotheses.flatMap((h) => h.contradictingEvidenceIds.slice(0, 4).map((id) => `${h.id}: ${evidenceLine(id)}`)).filter((l) => !l.endsWith("null")),
    view.hypotheses.flatMap((h) => h.contradictingEvidenceIds),
  );

  const kpiLines = view.kpis.map((k) => kpiLine(view, k.kpi.id)).filter((l): l is string => l !== null);
  const leadLagLines = view.leadLag
    .filter((l) => l.result.best)
    .map((l) => {
      const b = l.result.best!;
      return `${l.leader} → ${l.follower}: strongest in-sample correlation ${(b.correlation as number).toFixed(2)} at a ${b.lag}-month lag (n=${b.n}; ${l.result.stable ? "same sign in both halves" : "unstable across halves"}${l.result.holdout ? `; a lag chosen on data to ${l.result.holdout.splitMonth} ${l.result.holdout.confirmed ? "held" : "did not hold"} on later months (r ${l.result.holdout.holdoutCorrelation?.toFixed(2) ?? "n/a"})` : ""}). Exploratory, not predictive.`;
    });
  add("kpi-analysis", "Industry KPI Analysis", [...kpiLines, ...leadLagLines], view.kpis.map((k) => `EV-KPI-${k.kpi.id}`));

  add(
    "financial-analysis",
    "Financial Analysis",
    view.companies.map((c) => {
      const t = c.latestTtm;
      if (!t) return `${c.ticker}: TTM data unavailable.`;
      return `${c.ticker} TTM through ${t.label}: revenue ${usd(t.ttmRevenue, "B")} (${pct(t.ttmRevenueYoY ?? Number.NaN)}), operating margin ${t.ttmOperatingMargin === null ? "n/a" : `${(t.ttmOperatingMargin * 100).toFixed(1)}%`}, FCF ${usd(t.ttmFreeCashFlow)}, net debt ${usd(t.debt && t.cash !== null ? t.debt.total - t.cash : null)}${c.dataGaps.length ? ` (data gaps: ${c.dataGaps.length})` : ""}${cite(`EV-${c.ticker}-REV`)}.`;
    }),
    view.companies.map((c) => `EV-${c.ticker}-REV`),
  );

  add(
    "valuation",
    "Valuation",
    view.companies.map((c) => {
      const v = c.valuation;
      if (!v) return `${c.ticker}: valuation unavailable.`;
      const pctile = v.percentiles.evToEbitda;
      return `${c.ticker}: ${x(v.current.evToEbitda)} EV/EBITDA${pctile !== null ? ` (${ordinal(pctile * 100)} percentile of 5-year PIT history)` : ""}, ${x(v.current.pe)} P/E, FCF yield ${v.current.fcfYield === null ? "n/a" : `${(v.current.fcfYield * 100).toFixed(1)}%`}${cite(`EV-${c.ticker}-VAL`)}.`;
    }),
    view.companies.map((c) => `EV-${c.ticker}-VAL`),
    "Trailing multiples only; no forward estimates are connected.",
  );

  add(
    "scenarios",
    "Bull / Base / Bear Scenarios",
    [
      "Scenarios are anchored to each company's own 5-year range of TTM growth, margin and EV/EBITDA. They are stress cases, not forecasts. No probabilities are assigned unless the analyst enters them with a justification on the Thesis page.",
      ...focus.flatMap((c) =>
        scenarioResults(c).map(
          (s) => `${c.ticker} ${s.case}: growth ${pct(s.revenueGrowth)}, margin ${(s.operatingMargin * 100).toFixed(1)}%, ${s.evToEbitda.toFixed(1)}× → ${s.perShare === null ? "n/m" : `$${s.perShare.toFixed(0)}/share`} (${s.impliedReturn === null ? "n/m" : pct(s.impliedReturn)} vs $${c.valuation?.rawPrice.toFixed(2)}).`,
        ),
      ),
    ],
    [],
  );

  add(
    "catalysts",
    "Key Catalysts",
    view.catalysts.slice(0, 10).map((c) => `${c.date}: ${c.label}. ${c.confirmed ? "Scheduled." : "Estimated, not confirmed."}`),
  );

  add(
    "risks",
    "Major Risks",
    [
      ...view.hypotheses.filter((h) => h.overall === "contradicts" || h.overall === "mixed").map((h) => `${h.title} (${h.id}) is ${OUTCOME_WORD[h.overall]}: ${h.tests.filter((t) => t.outcome !== "supports").map((t) => `${t.description}: ${t.detail}`).join(" ")}`),
      "Fuel surcharge timing: diesel changes can affect reported revenue and margins at different times, depending on contract terms and recovery lags.",
      "Model risk: the fuel-adjusted residual depends on a linear historical fuel sensitivity and also captures omitted variables and model error. It is not a causal estimate of fuel pass-through or an observed ex-fuel freight rate.",
      "Comparability risk: company and business-model comparisons use each filer's latest available quarter; different reporting periods, segment mix and acquisitions can confound the group result.",
      "Expectations risk: trailing multiples and relative returns do not establish what recovery assumptions investors have already priced in; forward consensus estimates are unavailable.",
    ],
  );

  add(
    "invalidation",
    "Thesis Invalidation Conditions",
    view.hypotheses.flatMap((h) => h.triggers.map((t) => `${h.id}: ${t.description}. Current state: ${t.state} (${t.detail})`)),
    view.hypotheses.flatMap((h) => h.triggers.flatMap((t) => t.evidenceIds)),
  );

  add("open-questions", "Unresolved Research Questions", config.openQuestions);

  const failing = view.quality.filter((q) => q.state !== "pass");
  add("next-actions", "Next Research Actions", [
    "Test underlying pricing: compare matched ex-fuel spot and contract rates with shipment volumes over multiple releases. This can challenge the diesel-residual working view; the required rate feeds are not connected.",
    "Reconcile operating leverage: compare the same reporting quarters and segment-level volumes, yields and margins, separating acquisitions, fuel recovery and business mix before attributing a group difference to asset intensity.",
    "Test the expectations gap: compare the revenue growth and margins implied by current prices with forward earnings estimates and management guidance. Relative share-price returns alone cannot answer whether recovery is priced in.",
    ...config.missingData.map((m) => `${m.name}: ${m.requirement}`),
    ...config.stakeholders.slice(0, 3).map((s) => `Channel checks with ${s.label.toLowerCase()} to test ${s.hypothesisIds.join(", ")}.`),
    ...failing.map((q) => `Resolve quality check "${q.label}": ${q.detail}`),
  ]);

  const sources = new Map<string, string>();
  for (const e of view.evidence) if (e.source.url) sources.set(e.source.url, `${e.source.publisher}: ${e.source.title}`);
  add("sources", "Sources and Methodology", [
    "Methodology: point-in-time XBRL fundamentals (first-filed values, quarterised with explicit derivation); KPI YoY matched by calendar period; anomaly = |z| ≥ 2 vs trailing 36 months; fuel-adjusted residuals from OLS fitted before a 12-month holdout; lead-lag is in-sample and exploratory.",
    ...[...sources.entries()].slice(0, 40).map(([url, label]) => `${label} (${url})`),
  ]);

  add("limitations", "As-of Date and Data Limitations", [
    `As of ${view.asOf}. Snapshot built ${view.snapshot.builtAt}; refreshed by ${view.snapshot.builder}.`,
    "No spot/contract rate feed, no tender-rejection data, no consensus estimates, no earnings-call transcripts.",
    "No primary research recorded unless shown in your workspace. AI-generated text is not evidence.",
    ...view.companies.flatMap((c) => c.dataGaps.map((g) => `${c.ticker}: ${g}`)),
  ]);

  const known = new Set(view.evidence.map((e) => e.id));
  return sections.map((section, i) => ({
    ...section,
    number: i + 1,
    body: section.body.map((p) => sanitizeCitations(p, known)),
    evidenceIds: [...new Set(section.evidenceIds.filter((id) => known.has(id)))],
  }));
}

export interface MemoMeta {
  title: string;
  subtitle: string;
  asOf: string;
  builtAt: string;
}

export function memoMeta(view: ResearchProjectView): MemoMeta {
  return { title: view.config.title, subtitle: view.config.subtitle, asOf: view.asOf, builtAt: view.snapshot.builtAt };
}

export function memoToMarkdown(meta: MemoMeta, sections: MemoSection[], status: MemoStatus, edits: Record<string, string> = {}): string {
  const lines: string[] = [
    `# ${meta.title}`,
    `_${meta.subtitle}_`,
    "",
    `**Status:** ${MEMO_STATUS_LABEL[status]}  `,
    `**As of:** ${meta.asOf}  `,
    `**Snapshot:** ${meta.builtAt}  `,
    "**Disclaimer:** Independent research for educational purposes. Not investment advice. Not affiliated with any company or research provider mentioned.",
    "",
  ];
  for (const s of sections) {
    lines.push(`## ${s.number}. ${s.title}`, "");
    const edited = edits[s.id];
    if (edited !== undefined) {
      lines.push(edited, "", "_Edited by analyst; computed text replaced._", "");
    } else {
      for (const p of s.body) lines.push(p.startsWith("- ") ? p : `- ${p}`);
      lines.push("");
    }
    if (s.limitation) lines.push(`> Limitation: ${s.limitation}`, "");
  }
  return lines.join("\n");
}
