import { buildResearchBrief } from "./researchBrief";
import type { ResearchProjectView } from "./project";

/** The web brief and exported writing sample use the same computed observations. */
export function buildWritingSample(view: ResearchProjectView) {
  const brief = buildResearchBrief(view);
  const evidence = new Map(view.evidence.map((item) => [item.id, item]));
  const sources: Array<{ number: number; title: string; url: string }> = [];
  const sourceNumber = (id: string) => {
    const source = evidence.get(id)?.source;
    if (!source?.url) return null;
    let index = sources.findIndex((item) => item.url === source.url);
    if (index < 0) {
      sources.push({ number: sources.length + 1, title: source.title, url: source.url });
      index = sources.length - 1;
    }
    return sources[index].number;
  };
  const observations = brief.observations.map((observation) => ({
    ...observation,
    references: [...new Set([...observation.evidenceIds, ...(observation.label.includes("Pricing") ? ["EV-KPI-diesel"] : [])]
      .map(sourceNumber).filter((number): number is number => number !== null))],
  }));
  return {
    title: view.config.title,
    author: "Allen Xu",
    projectId: view.config.id,
    question: view.config.researchQuestion,
    conclusion: brief.conclusion,
    snapshotBuiltAt: view.snapshot.builtAt,
    asOfUtc: view.asOf,
    observations,
    alternativeExplanations: [
      "Fuel, freight mix and contract-reset timing can move headline prices. A diesel regression residual does not isolate their separate effects.",
      "Acquisitions, segment mix and cost timing can explain company margin differences. Consolidated results do not establish pricing power.",
    ],
    nextChecks: [
      { question: "Test underlying rates", test: "Match ex-fuel spot and contract rate changes with shipment activity in the same period; sustained gains in both would strengthen the recovery case." },
      { question: "Explain profit conversion", test: "Reconcile segment volumes, ex-fuel yield and fuel recovery in public earnings releases; use common-quarter comparisons before assigning a mechanism." },
      { question: "Challenge the view in calls", test: "Ask private shippers, fleet owners and brokers about comparable operations, then cross-check first-hand observations and disagreements. Fieldwork is planned, not completed." },
    ],
    sources,
    scope: "Independent public-data writing sample. No primary interviews are included. Observation periods differ; source figures and statistical proxies do not establish causality. No consensus expectations or investment recommendation is asserted.",
  };
}

export type WritingSample = ReturnType<typeof buildWritingSample>;
