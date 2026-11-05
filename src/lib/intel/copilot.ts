import { pct } from "@/lib/utils/format";
import { ordinal } from "./companies";
import { pp } from "./evidence";
import { variantView } from "./memo";
import { analyzeNotes, buildInterviewGuide, contradictionsWithHypotheses, redactPersonalData, screenText } from "./primary";
import type { ResearchProjectView } from "./project";
import type { Evidence } from "./types";

/**
 * Research Copilot: grounded, structured answers.
 *
 * Contract (identical for the LLM and the deterministic path):
 *  - facts and calculations MUST cite evidence IDs that were retrieved for this
 *    request; anything else is moved to `unsupported` and shown as such
 *  - interpretation and hypotheses are labelled as such
 *  - missing information is listed rather than filled in
 *  - no buy/sell recommendations or price targets
 */

export { COPILOT_TASKS } from "./copilotTypes";
export type { CopilotRequest, CopilotResponse, CopilotTask, Statement } from "./copilotTypes";
import type { CopilotRequest, CopilotResponse, Statement } from "./copilotTypes";

export const MAX_QUESTION_CHARS = 1_000;
export const MAX_TEXT_CHARS = 12_000;

// ── Retrieval ───────────────────────────────────────────────────────────────

const STOP = new Set("the a an and or of to in on for is are was were be by with as at from that this it its vs versus what which how why do does did".split(" "));

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function docText(e: Evidence): string {
  return [e.subject, e.claim, e.excerpt ?? "", e.tickers.join(" "), e.kpiIds.join(" ").replace(/-/g, " "), e.hypothesisIds.join(" ")].join(" ");
}

/** BM25-lite ranking over evidence claims. Deterministic; ties broken by id. */
export function retrieve(evidence: Evidence[], query: string, k = 12, boostIds: string[] = []): Evidence[] {
  const docs = evidence.map((e) => ({ e, tokens: tokenize(docText(e)) }));
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d.tokens)) df.set(t, (df.get(t) ?? 0) + 1);
  const n = docs.length;
  const avgLen = docs.reduce((s, d) => s + d.tokens.length, 0) / Math.max(1, n);
  const q = tokenize(query);
  const boost = new Set(boostIds);
  return docs
    .map((d) => {
      let score = boost.has(d.e.id) ? 100 : 0;
      for (const term of q) {
        const tf = d.tokens.filter((t) => t === term).length;
        if (tf === 0) continue;
        const idf = Math.log(1 + (n - (df.get(term) ?? 0) + 0.5) / ((df.get(term) ?? 0) + 0.5));
        score += (idf * tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (d.tokens.length / avgLen)));
      }
      return { e: d.e, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.e.id.localeCompare(b.e.id))
    .slice(0, k)
    .map((r) => r.e);
}

// ── Validation ──────────────────────────────────────────────────────────────

interface RawStatement {
  text?: unknown;
  evidenceIds?: unknown;
}

function cleanStatements(raw: unknown, allowed: Set<string>, requireCitation: boolean): { kept: Statement[]; rejected: Statement[] } {
  const kept: Statement[] = [];
  const rejected: Statement[] = [];
  if (!Array.isArray(raw)) return { kept, rejected };
  for (const item of raw.slice(0, 12) as RawStatement[]) {
    const text = typeof item?.text === "string" ? item.text.trim().slice(0, 600) : "";
    if (!text) continue;
    const ids = Array.isArray(item.evidenceIds) ? item.evidenceIds.filter((id): id is string => typeof id === "string") : [];
    const valid = ids.filter((id) => allowed.has(id));
    const invalid = ids.length !== valid.length;
    if (requireCitation && (valid.length === 0 || invalid)) rejected.push({ text, evidenceIds: ids });
    else kept.push({ text, evidenceIds: valid });
  }
  return { kept, rejected };
}

/**
 * Enforce the grounding contract on a model response: facts/calculations with
 * no citation, or citing an ID that was not retrieved (i.e., invented), are
 * moved to `unsupported`.
 */
export function validateModelOutput(raw: unknown, retrievedIds: string[]): Omit<CopilotResponse, "task" | "source" | "retrieved" | "warnings" | "origin"> {
  const allowed = new Set(retrievedIds);
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const facts = cleanStatements(obj.facts, allowed, true);
  const calcs = cleanStatements(obj.calculations, allowed, true);
  const followUps = Array.isArray(obj.followUps) ? obj.followUps.filter((f): f is string => typeof f === "string").map((f) => f.slice(0, 300)).slice(0, 8) : [];
  return {
    facts: facts.kept,
    calculations: calcs.kept,
    interpretation: cleanStatements(obj.interpretation, allowed, false).kept,
    hypotheses: cleanStatements(obj.hypotheses, allowed, false).kept,
    missing: cleanStatements(obj.missing, allowed, false).kept,
    followUps,
    unsupported: [...facts.rejected, ...calcs.rejected],
  };
}

// ── Deterministic answers ───────────────────────────────────────────────────

const s = (text: string, ...ids: string[]): Statement => ({ text, evidenceIds: ids.filter(Boolean) });

function emptyBody() {
  return { facts: [] as Statement[], calculations: [] as Statement[], interpretation: [] as Statement[], hypotheses: [] as Statement[], missing: [] as Statement[], followUps: [] as string[] };
}

function claimOf(view: ResearchProjectView, id: string): Statement | null {
  const e = view.evidence.find((x) => x.id === id);
  return e ? s(e.claim, e.id) : null;
}

export function deterministicAnswer(view: ResearchProjectView, req: CopilotRequest): ReturnType<typeof emptyBody> & { warnings: string[] } {
  const out = { ...emptyBody(), warnings: [] as string[] };
  const { config } = view;
  const push = (list: Statement[], st: Statement | null) => {
    if (st) list.push(st);
  };
  switch (req.task) {
    case "research-plan": {
      out.facts.push(s(`Research question: ${config.researchQuestion}`));
      config.objectives.forEach((o) => out.interpretation.push(s(`Objective: ${o}`)));
      view.kpis.slice(0, 8).forEach((k) => push(out.facts, claimOf(view, `EV-KPI-${k.kpi.id}`)));
      config.hypotheses.forEach((h) => out.hypotheses.push(s(`${h.id} ${h.title}: ${h.statement}`)));
      config.missingData.forEach((m) => out.missing.push(s(`${m.name} (${m.access}): ${m.requirement}`)));
      out.followUps.push(...config.stakeholders.map((st) => `Interview ${st.label.toLowerCase()}: ${st.why}`));
      break;
    }
    case "hypotheses":
    case "evidence-check": {
      const targets = req.hypothesisId ? view.hypotheses.filter((h) => h.id === req.hypothesisId) : view.hypotheses;
      for (const h of targets) {
        out.hypotheses.push(s(`${h.id} ${h.title} (${h.stance}): ${h.statement}. Overall: ${h.overall}.`));
        for (const t of h.tests) out.calculations.push(s(`${h.id} ${t.diagnosticOnly ? "diagnostic" : t.sensitivity ? "mean rule" : "screen"} — ${t.sensitivity ? t.outcome === "supports" ? "met" : "not met" : t.outcome}: ${t.description}. ${t.detail}`, ...t.evidenceIds));
        if (req.task === "evidence-check") {
          for (const id of h.supportingEvidenceIds.slice(0, 6)) {
            const c = claimOf(view, id);
            const reason = view.evidence.find((e) => e.id === id)?.stanceReasons?.[h.id];
            if (c) out.facts.push({ ...c, text: `Direction consistent with ${h.id}: ${c.text}${reason ? ` ${reason}` : ""}` });
          }
          for (const id of h.contradictingEvidenceIds.slice(0, 4)) {
            const c = claimOf(view, id);
            const reason = view.evidence.find((e) => e.id === id)?.stanceReasons?.[h.id];
            if (c) out.facts.push({ ...c, text: `Direction against ${h.id}: ${c.text}${reason ? ` ${reason}` : ""}` });
          }
          const checks = view.evidence.filter((e) => e.hypothesisIds.includes(h.id) && e.source.sourceType === "company-release");
          checks.forEach((e) => out.facts.push(s(`Company disclosure context for ${h.id}: ${e.claim}`, e.id)));
        }
        h.missingEvidence.forEach((m) => out.missing.push(s(`${h.id}: ${m}`)));
      }
      break;
    }
    case "leading-indicators": {
      for (const l of view.leadLag) {
        const b = l.result.best;
        if (!b) continue;
        out.calculations.push(
          s(`${l.leader} vs ${l.follower} (YoY): peak in-sample correlation ${(b.correlation as number).toFixed(2)} at ${b.lag}-month lag, n=${b.n}; halves ${l.result.firstHalf?.toFixed(2)} / ${l.result.secondHalf?.toFixed(2)}.`, `EV-KPI-${l.leader}`, `EV-KPI-${l.follower}`),
        );
      }
      view.kpis.filter((k) => k.kpi.timing === "leading").forEach((k) => out.interpretation.push(s(`${k.kpi.name} is treated as leading because: ${k.kpi.timingRationale}`)));
      out.missing.push(s("Correlation is not predictive power. An out-of-sample forecast test (rolling-origin) has not been run."));
      break;
    }
    case "compare": {
      for (const c of view.companies) {
        const r = c.latest;
        const v = c.valuation;
        if (r) out.facts.push(s(`${c.ticker} (${c.coverage.businessModel}) ${r.label}: revenue ${pct(r.revenueYoY ?? Number.NaN)} YoY, operating margin ${pp(r.operatingMarginYoYChange)} YoY.`, `EV-${c.ticker}-REV`, `EV-${c.ticker}-OM`));
        if (v?.current.evToEbitda) out.calculations.push(s(`${c.ticker}: ${v.current.evToEbitda.toFixed(1)}× EV/EBITDA, ${v.percentiles.evToEbitda !== null ? `${ordinal(v.percentiles.evToEbitda * 100)} percentile` : "percentile n/a"} of own history.`, `EV-${c.ticker}-VAL`));
      }
      out.interpretation.push(s("Business models differ (asset-based vs brokerage), so margins are compared as YoY changes, not levels."));
      out.missing.push(s("Segment-level results and adjusted gross profit per load are not in the XBRL snapshot."));
      break;
    }
    case "explain-financials": {
      const c = view.companies.find((x) => x.ticker === (req.ticker ?? "").toUpperCase()) ?? view.companies.find((x) => x.coverage.focus);
      if (!c) break;
      for (const id of ["REV", "OM", "FUEL", "VAL", "RET"]) push(out.facts, claimOf(view, `EV-${c.ticker}-${id}`));
      const t = c.latestTtm;
      if (t) out.calculations.push(s(`${c.ticker} TTM operating margin ${t.ttmOperatingMargin === null ? "n/a" : `${(t.ttmOperatingMargin * 100).toFixed(1)}%`}; TTM revenue growth ${pct(t.ttmRevenueYoY ?? Number.NaN)}.`, `EV-${c.ticker}-REV`));
      const fuel = view.kpis.find((k) => k.kpi.id === "diesel");
      if (fuel) push(out.facts, claimOf(view, "EV-KPI-diesel"));
      out.interpretation.push(s(`Revenue growth coinciding with higher fuel share and a diesel spike is consistent with fuel-surcharge pass-through. The filings disclose surcharge programs (see ${c.ticker} 10-K excerpts), but surcharge revenue itself is not XBRL-tagged.`));
      c.dataGaps.forEach((g) => out.missing.push(s(g)));
      break;
    }
    case "interview-guide": {
      const cat = config.stakeholders.find((x) => x.id === req.stakeholderId) ?? config.stakeholders[0];
      const guide = buildInterviewGuide(cat, config.hypotheses);
      out.interpretation.push(s(`Objective: ${guide.objective}`));
      guide.opening.forEach((q) => out.followUps.push(`Opening: ${q}`));
      guide.questions.forEach((q) => out.followUps.push(`Ask: ${q}`));
      guide.closing.forEach((q) => out.followUps.push(`Close: ${q}`));
      guide.cautions.forEach((c) => out.missing.push(s(`Compliance: ${c}`)));
      out.warnings.push("This guide is generated work product. Questions are not evidence, and answers only become evidence once you record a real interview.");
      break;
    }
    case "notes-analysis":
    case "kpi-extract": {
      const text = req.text ?? "";
      if (!text.trim()) {
        out.missing.push(s("Paste interview notes or a document excerpt to analyse."));
        break;
      }
      const analysis = analyzeNotes(text);
      analysis.flags.forEach((f) => out.warnings.push(`${f.kind}: ${f.message}`));
      for (const t of analysis.themes) out.interpretation.push(s(`${t.label}: direction ${t.direction}. "${t.sentences[0]}"`));
      for (const i of analysis.indicators) out.calculations.push(s(`Reported indicator ${i.value}: "${i.context}"`));
      for (const c of contradictionsWithHypotheses(analysis)) {
        out.hypotheses.push(s(`Notes on ${c.theme} point ${c.observed}, against ${c.hypothesisId}'s expectation (${c.expected}): "${c.sentence}"`));
      }
      out.missing.push(s("Notes are user-provided primary research: unverified until corroborated by another source or documented."));
      break;
    }
    case "memo-draft": {
      variantView(view).forEach((p) => {
        const ids = [...p.matchAll(/EV-[A-Za-z0-9-]+/g)].map((m) => m[0]);
        out.interpretation.push(s(p.replace(/\s*\[[^\]]*EV-[^\]]*\]/g, ""), ...ids));
      });
      view.hypotheses.forEach((h) => out.hypotheses.push(s(`${h.id} ${h.title}: ${h.overall}`, ...h.supportingEvidenceIds.slice(0, 1), ...h.contradictingEvidenceIds.slice(0, 1))));
      out.followUps.push("Open the Memo Builder to edit and export the full 19-section memo.");
      break;
    }
    case "missing-evidence": {
      view.hypotheses.forEach((h) => h.missingEvidence.forEach((m) => out.missing.push(s(`${h.id}: ${m}`))));
      config.missingData.forEach((m) => out.missing.push(s(`${m.name}: ${m.requirement}`)));
      view.quality.filter((q) => q.state !== "pass").forEach((q) => out.interpretation.push(s(`${q.label} (${q.state}): ${q.detail}`)));
      break;
    }
    case "invalidation": {
      view.hypotheses.forEach((h) => h.triggers.forEach((t) => out.calculations.push(s(`${h.id}: ${t.description}. State: ${t.state}. ${t.detail}`, ...t.evidenceIds))));
      out.interpretation.push(s("A triggered condition does not end the research; it means the thesis as stated is not supported and must be revised or retired."));
      break;
    }
    case "follow-ups": {
      config.openQuestions.forEach((q) => out.followUps.push(q));
      config.stakeholders.forEach((st) => out.followUps.push(`Channel check: ${st.label}, testing ${st.hypothesisIds.join(", ")}`));
      config.missingData.filter((m) => m.access === "public-not-connected").forEach((m) => out.followUps.push(`Build adapter: ${m.name}`));
      break;
    }
    case "question":
    default: {
      const hits = retrieve(view.evidence, req.question ?? "", 8);
      if (hits.length === 0) out.missing.push(s("No evidence in this project matches the question. Rephrase, or this may need data that is not connected."));
      hits.forEach((e) => out.facts.push(s(e.claim, e.id)));
      // Surface the hypothesis tests that rely on the same evidence: they are the project's computed answers.
      const hitIds = new Set(hits.map((e) => e.id));
      for (const h of view.hypotheses) {
        for (const t of h.tests.filter((x) => x.evidenceIds.some((id) => hitIds.has(id)))) {
          out.calculations.push(s(`${h.id} ${h.title}: ${t.description}: ${t.outcome}. ${t.detail}`, ...t.evidenceIds));
        }
      }
      out.interpretation.push(s("Deterministic mode lists the most relevant evidence and the hypothesis tests that use it. With a working LLM key, a synthesised answer is produced under the same citation rules."));
    }
  }
  return out;
}

// ── LLM prompt ──────────────────────────────────────────────────────────────

export const COPILOT_SYSTEM_PROMPT =
  "You are a disciplined equity research analyst inside a research workbench. You answer ONLY from the evidence list provided. " +
  "Rules: (1) Every item in `facts` and `calculations` must cite one or more evidence ids from the list in `evidenceIds`; never cite an id that is not in the list and never invent sources, numbers, quotes, interviews or URLs. " +
  "(2) Put judgement in `interpretation` and untested ideas in `hypotheses`. (3) List what is unknown or not connected in `missing`. " +
  "(4) Do not give buy/sell/hold recommendations, price targets or position sizes. (5) Treat user-provided notes as unverified primary research. " +
  "Use each evidence item's supplied stance and reason; a group mean's outcome cannot label every constituent. Directional consistency is not causal attribution, and a diesel-model residual is not an observed ex-fuel rate. " +
  "(6) Be concise and specific. Respond ONLY with JSON: {\"facts\":[{\"text\":\"\",\"evidenceIds\":[\"\"]}],\"calculations\":[...],\"interpretation\":[...],\"hypotheses\":[...],\"missing\":[...],\"followUps\":[\"\"]}.";

export function buildModelPayload(view: ResearchProjectView, req: CopilotRequest, retrieved: Evidence[]): string {
  const userText = req.text && req.allowAi ? redactPersonalData(req.text).slice(0, MAX_TEXT_CHARS) : undefined;
  return JSON.stringify({
    project: { title: view.config.title, question: view.config.researchQuestion, asOf: view.asOf },
    task: req.task,
    question: req.question?.slice(0, MAX_QUESTION_CHARS),
    focus: { hypothesisId: req.hypothesisId, ticker: req.ticker, stakeholderId: req.stakeholderId },
    hypothesisOutcomes: view.hypotheses.map((h) => ({ id: h.id, title: h.title, overall: h.overall, tests: h.tests.map((t) => ({ description: t.description, outcome: t.outcome, detail: t.detail, evidenceIds: t.evidenceIds })) })),
    evidence: retrieved.map((e) => ({ id: e.id, claim: e.claim, excerpt: e.excerpt?.slice(0, 400), publisher: e.source.publisher, observed: e.observationPeriod?.end, status: e.status, origin: e.origin, stance: e.stance, stanceReasons: e.stanceReasons })),
    userProvidedText: userText ? { origin: "user-primary (unverified)", text: userText } : undefined,
  });
}

/** Evidence IDs a task should always see, on top of lexical retrieval. */
export function boostIdsFor(view: ResearchProjectView, req: CopilotRequest): string[] {
  const ids: string[] = [];
  const hyps = req.hypothesisId ? view.hypotheses.filter((h) => h.id === req.hypothesisId) : view.hypotheses;
  for (const h of hyps) ids.push(...h.tests.flatMap((t) => t.evidenceIds), ...view.evidence.filter((e) => e.hypothesisIds.includes(h.id) && e.source.sourceType === "company-release").map((e) => e.id));
  if (req.ticker) ids.push(...view.evidence.filter((e) => e.tickers.includes(req.ticker!.toUpperCase())).map((e) => e.id));
  return ids;
}

export function requestScreen(req: CopilotRequest): { blockAi: boolean; warnings: string[] } {
  if (!req.text) return { blockAi: false, warnings: [] };
  const flags = screenText(req.text);
  const mnpi = flags.some((f) => f.kind === "mnpi-language");
  return {
    blockAi: mnpi || !req.allowAi,
    warnings: [
      ...flags.map((f) => `${f.kind}: ${f.message}`),
      ...(mnpi ? ["Possible MNPI language detected. The text was analysed locally only and NOT sent to an AI model."] : []),
      ...(!req.allowAi ? ["Your text was analysed deterministically on the server and not sent to an AI model (opt-in not given)."] : []),
    ],
  };
}
