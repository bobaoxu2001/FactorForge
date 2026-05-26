"use client";

import type { EquityPoint } from "@/types/backtest";
import { useEffect, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function DrawdownChart({ data }: { data: EquityPoint[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (data.length === 0) return <div className="card grid h-[260px] place-items-center text-[13px] text-ink-muted">No drawdown data available.</div>;
  const sampled = sample(data);
  return (
    <div className="card h-[260px] p-4">
      <div className="mb-3 text-[11px] uppercase tracking-wider text-ink-soft">Drawdown</div>
      {mounted ? (
        <ResponsiveContainer width="100%" height="86%">
          <AreaChart data={sampled}>
            <CartesianGrid stroke="#efeff2" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={28} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`} width={48} />
            <Tooltip formatter={(value) => `${(Number(value) * 100).toFixed(1)}%`} />
            <Area type="monotone" dataKey="drawdown" stroke="#e11d48" fill="#ffe4e6" strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="grid h-[86%] place-items-center text-[12px] text-ink-soft">Loading chart</div>
      )}
    </div>
  );
}

function sample(data: EquityPoint[]) {
  const step = Math.max(1, Math.floor(data.length / 260));
  return data.filter((_, index) => index % step === 0 || index === data.length - 1);
}
