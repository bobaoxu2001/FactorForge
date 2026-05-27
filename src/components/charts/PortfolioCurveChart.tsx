"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { PortfolioCurvePoint } from "@/lib/quant/portfolio";

export default function PortfolioCurveChart({ data, benchmarkSymbol }: { data: PortfolioCurvePoint[]; benchmarkSymbol: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (data.length === 0) {
    return <div className="card grid h-[320px] place-items-center p-4 text-[13px] text-ink-muted">No portfolio curve data available.</div>;
  }
  const step = Math.max(1, Math.floor(data.length / 260));
  const sampled = data.filter((_, index) => index % step === 0 || index === data.length - 1);

  return (
    <div className="card h-[320px] p-4">
      <div className="mb-3 text-[11px] uppercase tracking-wider text-ink-soft">Portfolio vs {benchmarkSymbol}</div>
      {mounted ? (
        <ResponsiveContainer width="100%" height="88%">
          <LineChart data={sampled}>
            <CartesianGrid stroke="rgba(120,149,184,0.14)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#69778d" }} axisLine={false} tickLine={false} minTickGap={28} />
            <YAxis tick={{ fontSize: 11, fill: "#69778d" }} axisLine={false} tickLine={false} width={64} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ background: "rgba(5,13,25,0.96)", border: "1px solid rgba(120,149,184,0.24)", borderRadius: 12, color: "#eef4ff" }}
              formatter={(value) => Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            />
            <Line type="monotone" dataKey="equity" stroke="#22d3ee" strokeWidth={2.3} dot={false} name="Portfolio" />
            <Line type="monotone" dataKey="benchmarkEquity" stroke="#60a5fa" strokeWidth={1.5} dot={false} name={benchmarkSymbol} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="grid h-[88%] place-items-center text-[12px] text-ink-soft">Loading chart</div>
      )}
    </div>
  );
}
