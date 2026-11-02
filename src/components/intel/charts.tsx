"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/**
 * Research charts. Formatting is passed as a token (not a function) so server
 * components can render these with plain serialisable props.
 */

export type ValueFormat = "pct" | "num" | "usdM" | "x" | "raw";

const formatters: Record<ValueFormat, (v: number) => string> = {
  pct: (v) => `${(v * 100).toFixed(1)}%`,
  num: (v) => v.toLocaleString("en-US", { maximumFractionDigits: 2 }),
  usdM: (v) => `$${(v / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 })}M`,
  x: (v) => `${v.toFixed(1)}×`,
  raw: (v) => String(v),
};

const TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #dde1e7",
  borderRadius: 12,
  color: "#18202c",
  fontSize: 12,
};

export interface SeriesSpec {
  key: string;
  label: string;
  color: string;
  kind?: "line" | "bar";
  axis?: "left" | "right";
  dashed?: boolean;
}

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function TimeSeriesChart({
  data,
  series,
  height = 240,
  leftFormat = "num",
  rightFormat,
  zeroLine = false,
  caption,
}: {
  data: Array<Record<string, number | string | null>>;
  series: SeriesSpec[];
  height?: number;
  leftFormat?: ValueFormat;
  rightFormat?: ValueFormat;
  zeroLine?: boolean;
  caption?: string;
}) {
  const mounted = useMounted();
  if (data.length === 0) return <div className="grid place-items-center rounded-md border border-dashed border-line text-[12px] text-ink-soft" style={{ height }}>No data</div>;
  const left = formatters[leftFormat];
  const right = rightFormat ? formatters[rightFormat] : left;
  return (
    <figure>
      <div className="mb-2 flex flex-wrap gap-3 text-[10.5px] text-ink-soft">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm" style={{ background: s.color, opacity: s.dashed ? 0.6 : 1 }} />
            {s.label}
          </span>
        ))}
      </div>
      <div style={{ height }}>
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: rightFormat ? 4 : 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#e6e9ee" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10.5, fill: "#677184" }} axisLine={false} tickLine={false} minTickGap={36} />
              <YAxis yAxisId="left" tick={{ fontSize: 10.5, fill: "#677184" }} axisLine={false} tickLine={false} width={58} tickFormatter={left} domain={["auto", "auto"]} />
              {rightFormat && <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10.5, fill: "#677184" }} axisLine={false} tickLine={false} width={58} tickFormatter={right} domain={["auto", "auto"]} />}
              {zeroLine && <ReferenceLine yAxisId="left" y={0} stroke="rgba(24,32,44,0.25)" />}
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "#475162", fontSize: 11 }}
                formatter={(value, name) => {
                  const spec = series.find((s) => s.label === name);
                  const f = spec?.axis === "right" ? right : left;
                  return typeof value === "number" ? f(value) : String(value ?? "—");
                }}
              />
              {series.map((s) =>
                s.kind === "bar" ? (
                  <Bar key={s.key} yAxisId={s.axis ?? "left"} dataKey={s.key} name={s.label} fill={s.color} opacity={0.75} radius={[2, 2, 0, 0]} />
                ) : (
                  <Line key={s.key} yAxisId={s.axis ?? "left"} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={s.dashed ? 1.4 : 2} strokeDasharray={s.dashed ? "5 5" : undefined} dot={false} connectNulls={false} />
                ),
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center text-[12px] text-ink-soft">Loading chart</div>
        )}
      </div>
      {caption && <figcaption className="mt-2 text-[11px] leading-relaxed text-ink-soft">{caption}</figcaption>}
    </figure>
  );
}

/** Correlation by lag (0…12): bars coloured by sign, highlighted best lag. */
export function LagBars({ lags, best, height = 150 }: { lags: Array<{ lag: number; correlation: number | null; n: number }>; best: number | null; height?: number }) {
  const mounted = useMounted();
  const data = lags.map((l) => ({ lag: `${l.lag}m`, correlation: l.correlation ?? 0, n: l.n, isBest: l.lag === best }));
  return (
    <div style={{ height }}>
      {mounted ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#e6e9ee" vertical={false} />
            <XAxis dataKey="lag" tick={{ fontSize: 10, fill: "#677184" }} axisLine={false} tickLine={false} />
            <YAxis domain={[-1, 1]} tick={{ fontSize: 10, fill: "#677184" }} axisLine={false} tickLine={false} width={34} />
            <ReferenceLine y={0} stroke="rgba(24,32,44,0.25)" />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => (typeof v === "number" ? v.toFixed(2) : String(v))} />
            <Bar dataKey="correlation" name="Correlation" radius={[2, 2, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.lag} fill={d.correlation >= 0 ? (d.isBest ? "#1d4f91" : "rgba(29,79,145,0.45)") : d.isBest ? "#b42318" : "rgba(180,35,24,0.45)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="grid h-full place-items-center text-[12px] text-ink-soft">Loading chart</div>
      )}
    </div>
  );
}

/** Tiny inline trend line for tiles. */
export function Sparkline({ values, color = "#1d4f91", height = 34 }: { values: Array<number | null>; color?: string; height?: number }) {
  const clean = values.map((v, i) => ({ i, v })).filter((p): p is { i: number; v: number } => p.v !== null && Number.isFinite(p.v));
  if (clean.length < 2) return <div style={{ height }} />;
  const min = Math.min(...clean.map((p) => p.v));
  const max = Math.max(...clean.map((p) => p.v));
  const span = max - min || 1;
  const w = 120;
  const path = clean.map((p, k) => `${k === 0 ? "M" : "L"}${((p.i / (values.length - 1)) * w).toFixed(1)},${(height - 2 - ((p.v - min) / span) * (height - 4)).toFixed(1)}`).join(" ");
  const zeroY = min < 0 && max > 0 ? height - 2 - ((0 - min) / span) * (height - 4) : null;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none" aria-hidden="true">
      {zeroY !== null && <line x1="0" x2={w} y1={zeroY} y2={zeroY} stroke="rgba(24,32,44,0.18)" strokeDasharray="3 3" />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
