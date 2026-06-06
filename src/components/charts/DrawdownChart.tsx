"use client";

import type { EquityPoint } from "@/types/backtest";
import { useEffect, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";

export default function DrawdownChart({ data }: { data: EquityPoint[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (data.length === 0) return <div className="card grid h-[260px] place-items-center text-[13px] text-ink-muted">No drawdown data available.</div>;
  const sampled = sample(data);
  const trough = sampled.reduce((min, point) => Math.min(min, point.drawdown ?? 0), 0);
  return (
    <div className="card h-[260px] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-ink-soft">Drawdown</div>
        <div className="num text-[11px] text-rose-300">Trough {(trough * 100).toFixed(1)}%</div>
      </div>
      {mounted ? (
        <ResponsiveContainer width="100%" height="84%">
          <AreaChart data={sampled} margin={{ top: 4, right: 6, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="ddFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(251,113,133,0)" />
                <stop offset="100%" stopColor="rgba(251,113,133,0.28)" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(120,149,184,0.12)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#69778d" }} axisLine={false} tickLine={false} minTickGap={28} />
            <YAxis tick={{ fontSize: 11, fill: "#69778d" }} axisLine={false} tickLine={false} tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`} width={48} />
            <ReferenceLine y={0} stroke="rgba(120,149,184,0.3)" />
            <Tooltip
              contentStyle={{ background: "rgba(5,13,25,0.96)", border: "1px solid rgba(120,149,184,0.24)", borderRadius: 12, color: "#eef4ff", boxShadow: "0 20px 50px -30px rgba(251,113,133,0.55)" }}
              labelStyle={{ color: "#a8b3c5", fontSize: 11 }}
              formatter={(value) => `${(Number(value) * 100).toFixed(1)}%`}
            />
            <Area type="monotone" dataKey="drawdown" stroke="#fb7185" fill="url(#ddFill)" strokeWidth={1.6} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="grid h-[84%] place-items-center text-[12px] text-ink-soft">Loading chart</div>
      )}
    </div>
  );
}

function sample(data: EquityPoint[]) {
  const step = Math.max(1, Math.floor(data.length / 260));
  return data.filter((_, index) => index % step === 0 || index === data.length - 1);
}
