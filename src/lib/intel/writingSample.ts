import { buildResearchBrief } from "./researchBrief";
import { createHash } from "node:crypto";
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
  const sample = {
    title: view.config.title,
    author: "Allen Xu",
    projectId: view.config.id,
    question: view.config.researchQuestion,
    conclusion: brief.conclusion,
    snapshotBuiltAt: view.snapshot.builtAt,
    asOfUtc: view.asOf,
    researchVersion: view.revision?.id ?? view.asOf,
    informationCutoff: view.revision?.informationCutoff ?? view.snapshot.builtAt,
    componentDates: view.componentDates,
    observations,
    alternativeExplanations: [
      "Fuel, freight mix and contract-reset timing can move headline prices. A diesel regression residual does not isolate their separate effects.",
      "Acquisitions, segment mix and cost timing can explain company margin differences. Consolidated results do not establish pricing power.",
    ],
    nextChecks: [
      { question: "Test durability and mechanism", test: "Track Cass linehaul and matched spot/contract rates with shipment activity across further releases; distinguish demand growth from capacity exits." },
      { question: "Explain profit conversion", test: "Extend Werner's GAAP/adjusted reconciliation to all peers on consistent definitions; check segment volumes, ex-fuel yield and acquisition mix." },
      { question: "Challenge the view in calls", test: "Ask private shippers, fleet owners and brokers about comparable operations, then cross-check first-hand observations and disagreements. Fieldwork is planned, not completed." },
    ],
    sources,
    contribution: "Project work: research framing, indicator selection, data preparation, calculations and source tracing in a reproducible workbench. Revision: direct Cass evidence changed the pricing judgment; peer sensitivity narrowed the operating-leverage claim.",
    aiAssistance: "AI assisted source lookup, implementation and drafting. User-supplied review prompted this revision; no interviews or independent analyst verification of every source are claimed.",
    scope: "Independent public-data writing sample. No primary interviews are included. Observation periods differ; source figures and statistical proxies do not establish causality. No consensus expectations or investment recommendation is asserted.",
  };
  return { ...sample, contentHash: createHash("sha256").update(JSON.stringify(sample)).digest("hex") };
}

export function sampleExportMatches(sample: WritingSample, exported: { contentHash?: string; researchVersion?: string }): boolean {
  return exported.contentHash === sample.contentHash && exported.researchVersion === sample.researchVersion;
}

export type WritingSample = ReturnType<typeof buildWritingSample>;
