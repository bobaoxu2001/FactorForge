import { buildResearchBrief, type BriefTextPart } from "./researchBrief";
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
  const citeParts = (parts?: BriefTextPart[]) => parts?.map((part) => ({ text: part.text, references: [...new Set((part.evidenceIds ?? []).map(sourceNumber).filter((number): number is number => number !== null))] }));
  const observations = brief.observations.map((observation) => {
    const references = [...new Set([...observation.evidenceIds, ...(observation.label.includes("Pricing") ? ["EV-KPI-diesel"] : [])]
      .map(sourceNumber).filter((number): number is number => number !== null))];
    return { ...observation, references, findingParts: citeParts(observation.findingParts), interpretationParts: citeParts(observation.interpretationParts) };
  });
  const sample = {
    title: view.config.title,
    author: "Allen Xu",
    authorRole: "Project lead & researcher",
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
    contribution: "I led and carried out this project end to end, owning the research question, indicator selection, data workflow, evidence assessment and final conclusions. Following review, I revised the analysis to incorporate direct rate evidence and peer sensitivity checks.",
    aiAssistance: "I used AI as a tool for source discovery, coding and drafting. Research design, evidence assessment and final conclusions remained my responsibility. No primary interviews have been completed; source checks are selective and do not constitute a full independent audit.",
    scope: "Independent public-data writing sample. No primary interviews are included. Observation periods differ; source figures and statistical proxies do not establish causality. No consensus expectations or investment recommendation is asserted.",
  };
  return { ...sample, contentHash: createHash("sha256").update(JSON.stringify(sample)).digest("hex") };
}

export function sampleExportMatches(sample: WritingSample, exported: { contentHash?: string; researchVersion?: string }): boolean {
  return exported.contentHash === sample.contentHash && exported.researchVersion === sample.researchVersion;
}

export type WritingSample = ReturnType<typeof buildWritingSample>;
