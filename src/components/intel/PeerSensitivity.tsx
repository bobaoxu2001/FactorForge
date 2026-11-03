import { pp } from "@/lib/intel/evidence";
import type { KpiTestResult } from "@/lib/intel/types";

export default function PeerSensitivity({ test }: { test: KpiTestResult }) {
  const s = test.sensitivity;
  if (!s) return null;
  return <div className="my-3 w-full rounded-md border border-line bg-paper p-3 text-[13px] text-ink">
    <p className="font-semibold">Common {test.period} · GAAP operating-margin change, YoY</p>
    <p className="mt-1">Asset-based: {s.groupA.members.map((r) => `${r.ticker} ${pp(r.value)}`).join(" · ")}. Median {pp(s.groupA.median)}.</p>
    <p className="mt-1">Asset-light: {s.groupB.members.map((r) => `${r.ticker} ${pp(r.value)}`).join(" · ")}. Median {pp(s.groupB.median)}.</p>
    <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[480px] text-right text-[12px]">
      <caption className="mb-2 text-left font-medium">All peers retained in the main result; each exclusion below is a sensitivity check</caption>
      <thead><tr className="text-ink-muted"><th className="py-2 text-left">Sample</th><th>Asset-based mean</th><th>Asset-light mean</th><th>Spread</th><th>Mean rule</th></tr></thead>
      <tbody className="divide-y divide-line"><tr className="font-semibold"><td className="py-2 text-left">All peers</td><td>{pp(s.groupA.mean)}</td><td>{pp(s.groupB.mean)}</td><td>{pp(s.spread)}</td><td>{s.spread > s.threshold ? "met" : "not met"}</td></tr>{s.leaveOneOut.map((r) => <tr key={r.omitted}><td className="py-2 text-left">Exclude {r.omitted}</td><td>{pp(r.meanA)}</td><td>{pp(r.meanB)}</td><td>{pp(r.spread)}</td><td>{r.passes ? "met" : "not met"}</td></tr>)}</tbody>
    </table></div>
    <p className="mt-3 leading-relaxed text-ink-muted">{s.unstable ? "The conclusion changes with sample composition or medians. Read the broader hypothesis as mixed and sample-sensitive." : "This small peer sample is a descriptive comparison."} Werner&apos;s reconciliation is available in the source check below; adjusted metrics require consistent definitions across every peer.</p>
  </div>;
}
