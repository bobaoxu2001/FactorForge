import type { DisclosedFigure } from "@/data/events/types";

/**
 * Formats a disclosed figure. A figure that was not disclosed reads "Not
 * disclosed", never 0; a range stays a range.
 */
export function formatFigure(f: Pick<DisclosedFigure, "value" | "unit">): string {
  const one = (v: number) => {
    switch (f.unit) {
      case "USD m":
        return `$${v.toLocaleString("en-US")}m`;
      case "%":
        return `${v.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
      case "MW":
        return `${v.toLocaleString("en-US")} MW`;
      case "years":
        return `${v} years`;
    }
  };
  if (f.value === null) return "Not disclosed";
  if (Array.isArray(f.value)) return `${one(f.value[0])} to ${one(f.value[1])}`;
  return one(f.value);
}
