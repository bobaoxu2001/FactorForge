import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import { Panel } from "@/components/intel/ui";
import { KPI_FRAMEWORKS } from "@/data/research/kpiFrameworks";

export const metadata = { title: "KPI frameworks", description: "Industry-specific KPI definitions for freight, software, retail and healthcare research." };

export default function FrameworksPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Research · KPI frameworks"
        title="Industry KPI frameworks"
        subtitle="What to measure in each industry, how it is defined, and where it typically comes from. Only freight is connected to data today. The others are templates and show no numbers until a source is connected."
      />
      {KPI_FRAMEWORKS.map((f) => (
        <Panel
          key={f.id}
          eyebrow={f.connectedProjectId ? "connected to data" : "definitions only · no connected source"}
          title={f.industry}
          actions={f.connectedProjectId ? <Link href={`/research/${f.connectedProjectId}/kpis`} className="text-[12px] text-accent hover:text-ink">Open live KPIs →</Link> : undefined}
        >
          <div className="mb-2 text-[12px] text-ink-muted">Value drivers: {f.valueDrivers.join(" · ")}</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[12px]">
              <thead className="text-[10px] text-ink-soft"><tr><th className="py-2 pr-3">KPI</th><th className="pr-3">Definition</th><th className="pr-3">Units · frequency</th><th className="pr-3">Timing</th><th className="pr-3">Typical sources</th><th>Comparability limits</th></tr></thead>
              <tbody className="divide-soft text-ink-muted">
                {f.kpis.map((k) => (
                  <tr key={k.name} className="align-top">
                    <td className="py-2 pr-3 font-medium text-ink">{k.name}</td>
                    <td className="pr-3">{k.definition}</td>
                    <td className="pr-3">{k.units} · {k.frequency}</td>
                    <td className="pr-3">{k.timing}</td>
                    <td className="pr-3">{k.typicalSources.join("; ")}</td>
                    <td>{k.comparability}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ))}
    </div>
  );
}
