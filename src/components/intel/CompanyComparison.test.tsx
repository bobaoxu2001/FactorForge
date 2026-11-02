import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import CompanyComparison, { type CompanyComparisonRow } from "./CompanyComparison";

afterEach(cleanup);

function company(ticker: string, revenueYoY: number | null, extra: Partial<CompanyComparisonRow> = {}): CompanyComparisonRow {
  return {
    ticker,
    name: `${ticker} Transport`,
    businessModel: "asset-based truckload",
    focus: true,
    quarter: "Q3 2026",
    ttmQuarter: "Q3 2026",
    metrics: {
      revenueYoY, operatingMargin: 0.05, marginChange: 0.01, fuelShare: null,
      freeCashFlow: 100e6, capexIntensity: 0.04, leverage: -0.2, roic: 0.08,
      evToEbitda: 10, historicalPercentile: 0.75, pe: null, relativeReturn6m: -0.1,
      volatility1y: 0.3, maxDrawdown1y: -0.2,
    },
    ...extra,
  };
}

const companies = [company("AAA", 0.1), company("BBB", null), company("CCC", 0.3, { focus: false, businessModel: "non-asset broker", quarter: "Q2 2026", ttmQuarter: "Q2 2026" })];
const tableOrder = () => within(screen.getByRole("table")).getAllByRole("rowheader").map((row) => within(row).getByRole("link").textContent);

describe("CompanyComparison", () => {
  it("sorts observed metrics in either direction while keeping missing figures last", () => {
    render(<CompanyComparison projectId="freight" companies={companies} />);
    expect(tableOrder()).toEqual(["AAA", "BBB", "CCC"]);

    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "revenueYoY" } });
    expect(tableOrder()).toEqual(["CCC", "AAA", "BBB"]);
    expect(screen.getByRole("columnheader", { name: /Revenue YoY/ })).toHaveAttribute("aria-sort", "descending");

    fireEvent.click(screen.getByRole("button", { name: "Sort ascending" }));
    expect(tableOrder()).toEqual(["AAA", "CCC", "BBB"]);
    expect(screen.getByRole("columnheader", { name: /Revenue YoY/ })).toHaveAttribute("aria-sort", "ascending");
  });

  it("combines business-model and focus filters, with a recoverable empty state", () => {
    render(<CompanyComparison projectId="freight" companies={companies} />);
    fireEvent.change(screen.getByLabelText("Business model"), { target: { value: "non-asset broker" } });
    expect(tableOrder()).toEqual(["CCC"]);
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1 of 3 companies");

    fireEvent.click(screen.getByRole("checkbox", { name: "Focus companies only" }));
    expect(screen.getByText("No companies match these filters.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(tableOrder()).toEqual(["AAA", "BBB", "CCC"]);
  });

  it("shows the chosen research lens in both the table and phone cards, preserving period and missing-data labels", () => {
    render(<CompanyComparison projectId="freight" companies={companies} />);
    fireEvent.click(screen.getByRole("button", { name: "Valuation & returns" }));
    expect(screen.getByRole("button", { name: "Valuation & returns" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("columnheader", { name: /6m excess vs SPY/ })).toBeInTheDocument();
    const cards = screen.getByRole("list", { name: "Company comparison cards" });
    expect(within(cards).getAllByText("75 / 100")).toHaveLength(3);
    expect(within(cards).getAllByText("n/m")).toHaveLength(3);
    expect(within(cards).getByText("Latest Q2 2026 · TTM to Q2 2026")).toBeInTheDocument();
    expect(within(cards).getByRole("link", { name: "AAA · AAA Transport" })).toHaveAttribute("href", "/research/freight/companies/AAA");

    fireEvent.click(screen.getByRole("button", { name: "Balance sheet & risk" }));
    expect(within(cards).getAllByText("n/t")).toHaveLength(3);
    expect(within(cards).getAllByText("-0.2×")).toHaveLength(3);
  });
});
