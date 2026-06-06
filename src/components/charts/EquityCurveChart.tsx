"use client";

import type { EquityPoint } from "@/types/backtest";
import { useEffect, useState } from "react";
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function EquityCurveChart({ data }: { data: EquityPoint[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (data.length === 0) return <EmptyChart message="No equity curve data available." />;
  const sampled = sample(data);
  const start = sampled[0]?.equity ?? 0;
  const last = sampled[sampled.length - 1]?.equity ?? start;
  const ahead = last >= (sampled[sampled.length - 1]?.benchmarkEquity ?? last);

  return (
    <div className="card relative h-[320px] overflow-hidden p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-ink-soft">Equity curve</div>
        <div className="flex items-center gap-3 text-[10.5px] text-ink-soft">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />Strategy</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-blue-400/70" />Benchmark</span>
        </div>
      </div>
      {mounted ? (
        <ResponsiveContainer width="100%" height="86%">
          <ComposedChart data={sampled} margin={{ top: 4, right: 6, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="equityFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(34,211,238,0.34)" />
                <stop offset="55%" stopColor="rgba(34,211,238,0.08)" />
                <stop offset="100%" stopColor="rgba(34,211,238,0)" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(120,149,184,0.12)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#69778d" }} axisLine={false} tickLine={false} minTickGap={28} />
            <YAxis tick={{ fontSize: 11, fill: "#69778d" }} axisLine={false} tickLine={false} width={64} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ background: "rgba(5,13,25,0.96)", border: "1px solid rgba(120,149,184,0.24)", borderRadius: 12, color: "#eef4ff", boxShadow: "0 20px 50px -30px rgba(34,211,238,0.6)" }}
              labelStyle={{ color: "#a8b3c5", fontSize: 11 }}
              formatter={(value) => Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            />
            <Line type="monotone" dataKey="benchmarkEquity" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="5 6" dot={false} name="Benchmark" />
            <Area type="monotone" dataKey="equity" stroke="#22d3ee" strokeWidth={2.4} fill="url(#equityFill)" dot={false} name="Strategy" activeDot={{ r: 4, fill: "#fbbf24", stroke: "rgba(5,13,25,0.9)", strokeWidth: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <div className="grid h-[86%] place-items-center text-[12px] text-ink-soft">Loading chart</div>
      )}
      <div className="absolute bottom-3 right-4 text-[10.5px] text-ink-soft">
        Ends {ahead ? "above" : "below"} benchmark
      </div>
    </div>
  );
}

function sample(data: EquityPoint[]) {
  const step = Math.max(1, Math.floor(data.length / 260));
  return data.filter((_, index) => index % step === 0 || index === data.length - 1);
}

function EmptyChart({ message }: { message: string }) {
  return <div className="card grid h-[320px] place-items-center p-4 text-[13px] text-ink-muted">{message}</div>;
}
