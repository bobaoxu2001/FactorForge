"use client";

import { useMemo, useState } from "react";
import type { CompanyImpact, ImpactEdge, ImpactGraph, Layer } from "@/lib/events/impact";

/**
 * Event → mechanism → industry → company → expectations → valuation → price,
 * as columns. Choosing a company traces every path from the event to it and
 * highlights the nodes and links on those paths; hypothesis-only links are
 * drawn dashed and do not count toward the net direction.
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
  positive: "positive",
  negative: "negative",
  ambiguous: "ambiguous (paths disagree)",
  unsupported: "unsupported (hypotheses only)",
};

const NET_STYLE: Record<CompanyImpact["net"], string> = {
  positive: "text-emerald-700",
  negative: "text-rose-700",
  ambiguous: "text-amber-800",
  unsupported: "text-ink-soft",
};

const SIGN_STYLE: Record<ImpactEdge["sign"], string> = { "+": "text-emerald-700", "-": "text-rose-700", "±": "text-amber-800" };

export default function ImpactMap({ graph, impacts, layers }: { graph: ImpactGraph; impacts: CompanyImpact[]; layers: Layer[] }) {
  const [selected, setSelected] = useState<string | null>(impacts[0]?.nodeId ?? null);
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  const impact = impacts.find((i) => i.nodeId === selected) ?? null;
  const onPath = new Set(impact?.paths.flatMap((p) => p.nodes) ?? []);
  const edgeKey = (a: string, b: string) => `${a}>${b}`;
  const pathEdges = new Set(impact?.paths.flatMap((p) => p.nodes.slice(1).map((n, i) => edgeKey(p.nodes[i], n))) ?? []);
  const edgesOnPath = graph.edges.filter((e) => pathEdges.has(edgeKey(e.from, e.to)));

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
                      isSelected ? "border-accent bg-accent-soft text-ink" : active ? "border-accent/50 bg-paper text-ink" : "border-line bg-panel2 text-ink-muted"
                    }`;
                    return (
                      <li key={n.id}>
                        {isCompany ? (
                          <button type="button" className={`${cls} hover:border-accent/60`} aria-pressed={isSelected} onClick={() => setSelected(n.id)}>
                            <span className="font-semibold">{n.ticker}</span> <span>{n.label}</span>
                          </button>
                        ) : (
                          <div className={cls}>{n.label}</div>
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
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-[15px] font-semibold text-ink">
              {impact.ticker} · {impact.label}
            </h3>
            <span className={`text-[13px] font-medium ${NET_STYLE[impact.net]}`}>Net on evidence-backed paths: {NET_LABEL[impact.net]}</span>
          </div>
          <p className="mt-1 text-[12.5px] text-ink-muted">Market check ({impact.marketCheck.replace("-", " ")}): {impact.marketNote}</p>
          <ol className="mt-3 space-y-2">
            {impact.paths.map((p) => (
              <li key={p.nodes.join(">")} className="text-[12.5px] leading-relaxed">
                <span className={`num mr-2 inline-block w-5 text-center font-semibold ${SIGN_STYLE[p.sign]}`}>{p.sign}</span>
                {p.nodes.map((id, i) => (
                  <span key={id}>
                    {i > 0 && <span className="mx-1 text-ink-soft">→</span>}
                    <span className={i === 0 || i === p.nodes.length - 1 ? "font-medium text-ink" : "text-ink-muted"}>{byId.get(id)?.label}</span>
                  </span>
                ))}
                <span className="ml-2 text-ink-soft">
                  · {p.supported ? "evidence on every link" : "rests on a hypothesis"} · weakest link {p.weakest} · {p.horizons.join("/")} term
                </span>
              </li>
            ))}
          </ol>
          <h4 className="mt-4 text-[12.5px] font-semibold text-ink">Links on these paths</h4>
          <ul className="mt-1.5 space-y-1.5">
            {edgesOnPath.map((e) => (
              <li key={edgeKey(e.from, e.to)} className={`border-l-2 pl-2 text-[12.5px] leading-relaxed ${e.evidence.length ? "border-accent/40" : "border-dashed border-ink/25"}`}>
                <span className={`num font-semibold ${SIGN_STYLE[e.sign]}`}>{e.sign}</span>{" "}
                <span className="text-ink">{byId.get(e.from)?.label} → {byId.get(e.to)?.label}</span>
                <span className="text-ink-muted">: {e.mechanism}</span>
                <span className="text-ink-soft"> · {e.epistemic.toLowerCase().replace("_", " ")} · {e.confidence} confidence · evidence: {e.evidence.length ? e.evidence.join(", ") : "none yet"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
