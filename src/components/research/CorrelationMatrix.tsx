import type { CorrelationCell } from "@/lib/quant/portfolio";

interface Props {
  cells: CorrelationCell[];
}

interface LegKey {
  symbol: string;
  strategy: string;
}

export default function CorrelationMatrix({ cells }: Props) {
  if (cells.length === 0) {
    return <div className="card grid place-items-center p-6 text-[13px] text-ink-muted">No correlation data.</div>;
  }
  const legs: LegKey[] = [];
  const seen = new Set<string>();
  cells.forEach((cell) => {
    const key = `${cell.rowSymbol}::${cell.rowStrategy}`;
    if (!seen.has(key)) {
      seen.add(key);
      legs.push({ symbol: cell.rowSymbol, strategy: cell.rowStrategy });
    }
  });

  return (
    <div className="card overflow-x-auto p-4">
      <div className="mb-3 text-[11px] tracking-wider text-ink-soft">Daily return correlation</div>
      <table className="w-full min-w-[420px] text-[12px]">
        <thead>
          <tr>
            <th className="px-2 py-2 text-left text-ink-soft">Leg</th>
            {legs.map((leg) => (
              <th key={`${leg.symbol}-${leg.strategy}`} className="px-2 py-2 text-right text-ink-soft">{leg.symbol}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {legs.map((row) => (
            <tr key={`${row.symbol}-${row.strategy}`} className="border-t border-line/40">
              <td className="px-2 py-2 text-ink">{row.symbol}</td>
              {legs.map((col) => {
                const cell = cells.find(
                  (c) =>
                    c.rowSymbol === row.symbol &&
                    c.rowStrategy === row.strategy &&
                    c.colSymbol === col.symbol &&
                    c.colStrategy === col.strategy,
                );
                const value = cell?.correlation ?? 0;
                return (
                  <td key={`${col.symbol}-${col.strategy}`} className="num px-2 py-2 text-right" style={{ color: colorFor(value) }}>
                    {value.toFixed(2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function colorFor(value: number): string {
  if (value >= 0.85) return "#b42318"; // hot red — diversification weak
  if (value >= 0.6) return "#a15c07";
  if (value >= 0.3) return "#4d7c0f";
  if (value >= 0) return "#1d4f91";
  return "#8a93a3"; // negative correlation — best diversifier
}
