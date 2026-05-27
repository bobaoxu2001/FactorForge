import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CorrelationMatrix from "./CorrelationMatrix";
import type { CorrelationCell } from "@/lib/quant/portfolio";

const cells: CorrelationCell[] = [
  { rowSymbol: "AAPL", rowStrategy: "A", colSymbol: "AAPL", colStrategy: "A", correlation: 1 },
  { rowSymbol: "AAPL", rowStrategy: "A", colSymbol: "MSFT", colStrategy: "B", correlation: 0.42 },
  { rowSymbol: "MSFT", rowStrategy: "B", colSymbol: "AAPL", colStrategy: "A", correlation: 0.42 },
  { rowSymbol: "MSFT", rowStrategy: "B", colSymbol: "MSFT", colStrategy: "B", correlation: 1 },
];

describe("CorrelationMatrix", () => {
  it("renders one row per unique leg", () => {
    render(<CorrelationMatrix cells={cells} />);
    expect(screen.getAllByText("AAPL").length).toBeGreaterThan(0);
    expect(screen.getAllByText("MSFT").length).toBeGreaterThan(0);
  });

  it("shows the off-diagonal correlation rounded to 2 decimals", () => {
    render(<CorrelationMatrix cells={cells} />);
    expect(screen.getAllByText("0.42").length).toBeGreaterThanOrEqual(2);
  });

  it("shows a friendly empty state when there are no cells", () => {
    render(<CorrelationMatrix cells={[]} />);
    expect(screen.getByText(/no correlation data/i)).toBeInTheDocument();
  });
});
