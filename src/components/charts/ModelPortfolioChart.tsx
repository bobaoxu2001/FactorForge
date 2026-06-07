"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { ModelPortfolioPerformance } from "@/lib/quant/modelPortfolio";

/**
 * Clean line chart for the "Since May" simulated model portfolio.
 * Muted cyan/green model portfolio line + muted gray SPY/QQQ benchmark lines.
 * No candlesticks. Values are indexed to 100 on the start date.
 */
export default function ModelPortfolioChart({
  data,
  height = 300,
}: {
  data: ModelPortfolioPerformance;
  height?: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!data.available || data.equityCurve.length === 0) {
    return (
      <div
        className="card grid place-items-center p-4 text-[13px] text-ink-muted"
        style={{ height }}
      >
        No simulated model portfolio data available for this period.
      </div>
    );
  }

  const hasSpy = data.benchmarkCurve.some((point) => point.spy !== null);
  const hasQqq = data.benchmarkCurve.some((point) => point.qqq !== null);
  const merged = data.equityCurve.map((point, index) => ({
    date: point.date,
    portfolio: round2(point.value),
    spy: round2(data.benchmarkCurve[index]?.spy ?? null),
    qqq: round2(data.benchmarkCurve[index]?.qqq ?? null),
  }));

  return (
    <div className="card relative overflow-hidden p-4" style={{ height: height + 56 }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wider text-ink-soft">
          Simulated model portfolio · indexed to 100 on {data.startDate}
        </div>
        <div className="flex items-center gap-3 text-[10.5px] text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
            Model portfolio
          </span>
          {hasSpy && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-full bg-slate-400/80" />
              SPY
            </span>
          )}
          {hasQqq && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-full bg-slate-500/70" />
              QQQ
            </span>
          )}
        </div>
      </div>
      {mounted ? (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={merged} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(120,149,184,0.12)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#69778d" }}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#69778d" }}
              axisLine={false}
              tickLine={false}
              width={48}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(5,13,25,0.96)",
                border: "1px solid rgba(120,149,184,0.24)",
                borderRadius: 12,
                color: "#eef4ff",
                boxShadow: "0 20px 50px -30px rgba(34,211,238,0.6)",
              }}
              labelStyle={{ color: "#a8b3c5", fontSize: 11 }}
              formatter={(value, name) => [Number(value).toFixed(2), labelFor(name)]}
            />
            {hasSpy && (
              <Line
                type="monotone"
                dataKey="spy"
                stroke="#94a3b8"
                strokeWidth={1.5}
                dot={false}
                name="spy"
                connectNulls
              />
            )}
            {hasQqq && (
              <Line
                type="monotone"
                dataKey="qqq"
                stroke="#64748b"
                strokeWidth={1.5}
                strokeDasharray="5 6"
                dot={false}
                name="qqq"
                connectNulls
              />
            )}
            <Line
              type="monotone"
              dataKey="portfolio"
              stroke="#34d399"
              strokeWidth={2.4}
              dot={false}
              name="portfolio"
              activeDot={{ r: 4, fill: "#34d399", stroke: "rgba(5,13,25,0.9)", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="grid place-items-center text-[12px] text-ink-soft" style={{ height }}>
          Loading chart
        </div>
      )}
    </div>
  );
}

function labelFor(name: unknown): string {
  if (name === "portfolio") return "Model portfolio";
  if (name === "spy") return "SPY";
  if (name === "qqq") return "QQQ";
  return String(name);
}

function round2(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}
