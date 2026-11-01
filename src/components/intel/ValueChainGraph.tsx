"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Relationship, ValueChainNode } from "@/lib/intel/types";

export interface EdgeEvidence {
  id: string;
  claim: string;
  excerpt?: string;
  ticker: string;
}

const LAYERS: Array<{ id: ValueChainNode["layer"]; label: string }> = [
  { id: "input", label: "Inputs & suppliers" },
  { id: "capacity", label: "Capacity providers" },
  { id: "intermediary", label: "Intermediaries" },
  { id: "demand", label: "Shippers (demand)" },
];

const EDGE_STYLE: Record<Relationship["status"], { stroke: string; dash?: string; label: string }> = {
  verified: { stroke: "#34d399", label: "verified in 10-K" },
  inferred: { stroke: "#fbbf24", dash: "6 5", label: "inferred" },
  hypothetical: { stroke: "#94a3b8", dash: "2 5", label: "hypothetical" },
};

const W = 1000;
const NODE_W = 190;
const NODE_H = 46;

/**
 * Interactive value-chain map. Edge styling encodes evidence status, so an
 * analyst can see at a glance which links are documented in filings and which
 * are reasoning that still needs verification.
 */
export default function ValueChainGraph({
  projectId,
  nodes,
  relationships,
  evidence,
}: {
  projectId: string;
  nodes: ValueChainNode[];
  relationships: Relationship[];
  evidence: Record<string, EdgeEvidence>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [edgeId, setEdgeId] = useState<string | null>(null);

  const layout = useMemo(() => {
    const colX = (i: number) => 20 + i * ((W - 40 - NODE_W) / (LAYERS.length - 1));
    const maxRows = Math.max(...LAYERS.map((l) => nodes.filter((n) => n.layer === l.id).length));
    const height = 70 + maxRows * (NODE_H + 26);
    const pos = new Map<string, { x: number; y: number }>();
    LAYERS.forEach((layer, i) => {
      const col = nodes.filter((n) => n.layer === layer.id);
      const total = col.length * NODE_H + (col.length - 1) * 26;
      const top = 54 + (height - 54 - total) / 2;
      col.forEach((n, k) => pos.set(n.id, { x: colX(i), y: top + k * (NODE_H + 26) }));
    });
    return { pos, height, colX };
  }, [nodes]);

  const visible = (r: Relationship) => !selected || r.from === selected || r.to === selected;
  const activeEdges = relationships.filter(visible);
  const shown = edgeId ? relationships.filter((r) => r.id === edgeId) : activeEdges;

  return (
    <div className="grid gap-4 xl:grid-cols-[1.45fr_0.85fr]">
      <div className="overflow-x-auto rounded-2xl border border-line bg-[#040b16]/70 p-2">
        <svg viewBox={`0 0 ${W} ${layout.height}`} className="min-w-[640px]" role="img" aria-label="Freight value chain graph">
          {LAYERS.map((l, i) => (
            <text key={l.id} x={layout.colX(i) + NODE_W / 2} y={26} textAnchor="middle" fill="#69778d" fontSize="12" letterSpacing="1.5">
              {l.label.toUpperCase()}
            </text>
          ))}
          {relationships.map((r) => {
            const a = layout.pos.get(r.from);
            const b = layout.pos.get(r.to);
            if (!a || !b) return null;
            const forward = b.x >= a.x;
            const x1 = forward ? a.x + NODE_W : a.x;
            const x2 = forward ? b.x : b.x + NODE_W;
            const y1 = a.y + NODE_H / 2;
            const y2 = b.y + NODE_H / 2;
            const dx = Math.max(60, Math.abs(x2 - x1) / 2);
            const d = `M${x1},${y1} C${x1 + (forward ? dx : -dx)},${y1} ${x2 - (forward ? dx : -dx)},${y2} ${x2},${y2}`;
            const style = EDGE_STYLE[r.status];
            const on = visible(r) && (!edgeId || edgeId === r.id);
            return (
              <path
                key={r.id}
                d={d}
                fill="none"
                stroke={style.stroke}
                strokeWidth={on ? 2.2 : 1}
                strokeDasharray={style.dash}
                opacity={on ? 0.9 : 0.12}
                className="cursor-pointer"
                onClick={() => setEdgeId(edgeId === r.id ? null : r.id)}
              >
                <title>{`${r.label} (${r.status})`}</title>
              </path>
            );
          })}
          {nodes.map((n) => {
            const p = layout.pos.get(n.id)!;
            const isSel = selected === n.id;
            const related = !selected || isSel || relationships.some((r) => (r.from === selected && r.to === n.id) || (r.to === selected && r.from === n.id));
            return (
              <g key={n.id} transform={`translate(${p.x},${p.y})`} className="cursor-pointer" opacity={related ? 1 : 0.35} onClick={() => { setSelected(isSel ? null : n.id); setEdgeId(null); }}>
                <rect width={NODE_W} height={NODE_H} rx={12} fill={isSel ? "rgba(34,211,238,0.16)" : "rgba(13,22,36,0.95)"} stroke={isSel ? "#22d3ee" : "rgba(120,149,184,0.35)"} />
                <text x={12} y={19} fill="#eef4ff" fontSize="12.5" fontWeight="600">{n.label}</text>
                <text x={12} y={35} fill="#7dd3fc" fontSize="10.5" fontFamily="ui-monospace, monospace">{n.tickers.length ? n.tickers.join(" · ") : "—"}</text>
              </g>
            );
          })}
        </svg>
        <div className="flex flex-wrap gap-4 px-2 pb-1 pt-2 text-[11px] text-ink-soft">
          {Object.entries(EDGE_STYLE).map(([k, s]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <svg width="26" height="6"><line x1="0" x2="26" y1="3" y2="3" stroke={s.stroke} strokeWidth="2" strokeDasharray={s.dash} /></svg>
              {s.label}
            </span>
          ))}
          <span>Click a node to isolate its links; click an edge for its evidence.</span>
        </div>
      </div>
      <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
        <div className="flex items-center justify-between text-[11.5px] text-ink-soft">
          <span>{selected ? nodes.find((n) => n.id === selected)?.label : "All relationships"} · {shown.length}</span>
          {(selected || edgeId) && <button className="text-cyan-200 hover:text-white" onClick={() => { setSelected(null); setEdgeId(null); }}>Clear</button>}
        </div>
        {shown.map((r) => (
          <div key={r.id} className="rounded-xl border border-line bg-white/[0.025] p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="text-[12.5px] font-medium text-ink">{r.label}</div>
              <span className="text-[10.5px] uppercase tracking-[0.12em]" style={{ color: EDGE_STYLE[r.status].stroke }}>{r.status}</span>
            </div>
            <div className="mt-0.5 text-[11px] text-ink-soft">{nodes.find((n) => n.id === r.from)?.label} → {nodes.find((n) => n.id === r.to)?.label} · {r.type.replace("-", " ")}</div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">{r.rationale}</p>
            {r.evidenceIds.map((id) => {
              const e = evidence[id];
              if (!e) return null;
              return (
                <blockquote key={id} className="mt-2 border-l-2 border-emerald-400/40 pl-2 text-[11.5px] leading-relaxed text-ink-muted">
                  &ldquo;{e.excerpt}&rdquo;
                  <Link href={`/research/${projectId}/evidence?id=${id}`} className="ml-1 font-mono text-[10px] text-blue-200 hover:text-white">{e.ticker} 10-K ↗</Link>
                </blockquote>
              );
            })}
            {r.evidenceIds.length === 0 && <div className="mt-2 text-[11px] text-amber-100/80">No filing sentence supports this link yet. Treat it as reasoning to verify.</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
