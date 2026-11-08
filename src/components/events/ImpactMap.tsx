"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { COMPARISON_LABEL, LINK_STATUS_LABEL, type CompanyImpact, type ImpactGraph, type Layer, type LinkAssessment, type PathTrace, type Sign } from "@/lib/events/impact";

/**
 * Event → mechanism → industry → company → expectations → valuation → price,
 * as columns. Choosing a company shows one mechanism at a time: the main one
 * first, the competing ones a click away. Each link says in words whether its
 * evidence bears on it or only on a background fact, and what assumption
 * carries it. Signs are a qualitative scenario aid, never an estimate.
 */

const LAYER_LABEL: Record<Layer, string> = {
  event: "Event",
  mechanism: "Mechanism",
  industry: "Industry",
  company: "Company",
  expectations: "Expectations",
  valuation: "Valuation / risk premium",
  price: "Price response",
};

const NET_LABEL: Record<CompanyImpact["net"], string> = {
  positive: "positive on every evidence-backed path",
  negative: "negative on every evidence-backed path",
  ambiguous: "evidence-backed paths disagree",
  unsupported: "none: every path rests on at least one assumption",
};

const SCENARIO_LABEL: Record<CompanyImpact["scenario"], string> = {
  raises: "every proposed mechanism would raise this company's business",
  lowers: "every proposed mechanism would lower this company's business",
  mixed: "some proposed mechanisms would raise it, others lower it",
  none: "no proposed mechanism reaches this company",
};

const PATH_SIGN: Record<Sign, string> = { "+": "would raise", "-": "would lower", "±": "either way" };
const LINK_SIGN: Record<Sign, string> = { "+": "moves with", "-": "moves against", "±": "either way" };

const STATUS_STYLE: Record<LinkAssessment["status"], string> = {
  "direct-evidence": "border-accent/50",
  "background-only": "border-dashed border-ink/35",
  "no-evidence": "border-dotted border-ink/35",
};

const pct = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`);

function pathName(p: PathTrace, byId: Map<string, { label: string }>) {
  return p.nodes
    .slice(1, -1)
    .map((id) => byId.get(id)?.label ?? id)
    .join(" → ");
}

export default function ImpactMap({ graph, impacts, layers, caseSlug, initial, mainPaths }: { graph: ImpactGraph; impacts: CompanyImpact[]; layers: Layer[]; caseSlug: string; initial?: string; mainPaths?: Record<string, string[]> }) {
  const [selected, setSelected] = useState<string | null>(initial ?? impacts[0]?.nodeId ?? null);
  const [pathIndex, setPathIndex] = useState(0);
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  const impact = impacts.find((i) => i.nodeId === selected) ?? null;

  // Main mechanism first, if one is designated for this company.
  const ordered = useMemo(() => {
    if (!impact) return [];
    const main = mainPaths?.[impact.nodeId]?.join(">");
    return [...impact.paths].sort((a, b) => Number(b.nodes.join(">") === main) - Number(a.nodes.join(">") === main));
  }, [impact, mainPaths]);
  const hasMain = !!(impact && mainPaths?.[impact.nodeId]);
  const path = ordered[Math.min(pathIndex, ordered.length - 1)] ?? null;
  const onPath = new Set(path?.nodes ?? []);

  return (
    <div>
      <div className="-mx-5 overflow-x-auto px-5 md:-mx-6 md:px-6">
        <div className="grid min-w-[980px] grid-cols-7 gap-3">
          {layers.map((layer) => (
            <div key={layer}>
              <div className="mb-2 text-[11.5px] font-semibold text-ink-soft">{LAYER_LABEL[layer]}</div>
              <ul className="space-y-1.5">
                {graph.nodes
                  .filter((n) => n.layer === layer)
                  .map((n) => {
                    const isCompany = n.layer === "company";
                    const active = onPath.has(n.id);
                    const isSelected = n.id === selected;
                    const cls = `w-full rounded-md border px-2 py-1.5 text-left text-[12px] leading-snug transition-colors ${
                      isSelected ? "border-accent bg-accent-soft font-medium text-ink" : active ? "border-accent/60 bg-paper text-ink underline decoration-accent/50 underline-offset-2" : "border-line bg-panel2 text-ink-muted"
                    }`;
                    return (
                      <li key={n.id}>
                        {isCompany ? (
                          <button
                            type="button"
                            className={`${cls} hover:border-accent/60`}
                            aria-pressed={isSelected}
                            onClick={() => {
                              setSelected(n.id);
                              setPathIndex(0);
                            }}
                          >
                            <span className="font-semibold">{n.ticker}</span> <span>{n.label}</span>
                          </button>
                        ) : (
                          <div className={cls}>
                            {active && <span className="sr-only">On the selected mechanism: </span>}
                            {n.label}
                          </div>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {impact && (
        <div className="mt-5 rounded-md border border-line p-4" aria-live="polite">
          <h3 className="text-[15px] font-semibold text-ink">
            {impact.ticker} · {impact.label}
          </h3>
          <dl className="mt-2 space-y-1 text-[12.5px] leading-relaxed">
            <div>
              <dt className="inline font-medium text-ink">Evidence-backed direction: </dt>
              <dd className="inline text-ink-muted">{NET_LABEL[impact.net]}.</dd>
            </div>
            <div>
              <dt className="inline font-medium text-ink">Scenario aid: </dt>
              <dd className="inline text-ink-muted">{SCENARIO_LABEL[impact.scenario]}. Signs multiplied along a path show which way a mechanism would push if it held; they are not an estimate of earnings or returns.</dd>
            </div>
            <div>
              <dt className="inline font-medium text-ink">Observed price response: </dt>
              <dd className="inline text-ink-muted">
                {impact.observed
                  ? `${pct(impact.observed.raw)} raw and ${pct(impact.observed.abnormal)} beyond ${impact.observed.benchmark ?? "its own history"} on ${impact.observed.day0} (${impact.observed.significant ? "beyond noise" : "within noise"}).`
                  : "not measured in this window."}{" "}
                {COMPARISON_LABEL[impact.comparison.state]}: {impact.comparison.note}
              </dd>
            </div>
          </dl>

          {ordered.length > 0 && (
            <>
              <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Mechanisms reaching this company">
                {ordered.map((p, i) => (
                  <button
                    key={p.nodes.join(">")}
                    type="button"
                    aria-pressed={i === pathIndex}
                    onClick={() => setPathIndex(i)}
                    className={`rounded-md border px-2 py-1 text-left text-[12px] leading-snug ${i === pathIndex ? "border-accent bg-accent-soft font-medium text-ink" : "border-line text-ink-muted hover:border-accent/50"}`}
                  >
                    {i === 0 && hasMain ? "Main mechanism" : `${hasMain ? "Competing" : "Mechanism"} ${hasMain ? i : i + 1}`}: {PATH_SIGN[p.sign]} · {p.assumptions === 0 ? "evidence on every link" : `${p.assumptions} assumption${p.assumptions === 1 ? "" : "s"}`}
                  </button>
                ))}
              </div>
              {path && (
                <div className="mt-3">
                  <p className="text-[13px] text-ink">
                    <span className="font-medium">{pathName(path, byId)}</span> <span className="text-ink-muted">— {PATH_SIGN[path.sign]} {impact.ticker ?? impact.label}&apos;s business if every link held; {path.horizons.join("/")} term.</span>
                  </p>
                  <ol className="mt-2 space-y-2.5">
                    {path.links.map((l) => (
                      <li key={`${l.edge.from}>${l.edge.to}`} className={`border-l-2 pl-3 text-[12.5px] leading-relaxed ${STATUS_STYLE[l.status]}`}>
                        <div className="text-ink">
                          <span className="font-medium">{byId.get(l.edge.from)?.label}</span> → <span className="font-medium">{byId.get(l.edge.to)?.label}</span>{" "}
                          <span className="text-ink-soft">({LINK_SIGN[l.edge.sign]}; {l.edge.epistemic.toLowerCase().replace(/_/g, " ")})</span>
                        </div>
                        <div className="text-ink-muted">{l.edge.mechanism}</div>
                        <div className="mt-0.5 font-medium text-ink">{LINK_STATUS_LABEL[l.status]}</div>
                        {l.edge.establishes && <div className="text-ink-muted"><span className="text-ink-soft">Evidence establishes: </span>{l.edge.establishes}</div>}
                        {l.edge.assumption && <div className="text-ink-muted"><span className="text-ink-soft">Assumption: </span>{l.edge.assumption}</div>}
                        {l.edge.wouldChallenge && <div className="text-ink-muted"><span className="text-ink-soft">Would challenge it: </span>{l.edge.wouldChallenge}</div>}
                        {l.evidence.length > 0 && (
                          <ul className="mt-1 flex flex-wrap gap-1">
                            {l.evidence.map((e) => (
                              <li key={e.id}>
                                {e.exists ? (
                                  <Link
                                    href={e.id.startsWith("MKT:") ? `/events/${caseSlug}/market#${e.id.split(":")[1]}` : e.id.startsWith("EXP:") ? `/events/${caseSlug}/impact#exposure` : e.id.startsWith("FIG:") ? `/events/${caseSlug}/impact#fig-${e.id.slice(4)}` : `/events/${caseSlug}/evidence#${e.id}`}
                                    className={`inline-block rounded border px-1 py-px text-[11.5px] hover:underline ${e.relevance === "direct" && e.available && e.admissible ? "border-ink/20 bg-panel2 text-ink" : "border-dashed border-ink/25 text-ink-muted"}`}
                                  >
                                    {e.label} — {e.available ? e.status : "not available at cutoff"} · {e.relevance === "direct" ? "bears on this link" : "background"}
                                  </Link>
                                ) : (
                                  <span className="rounded border border-rose-600/40 px-1 py-px text-[11.5px] text-rose-800">unknown reference {e.id}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
