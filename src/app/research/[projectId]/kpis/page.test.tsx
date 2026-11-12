import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import KpiPage from "./page";

vi.mock("@/components/intel/charts", () => ({ LagBars: () => null, Sparkline: () => null, TimeSeriesChart: () => null }));
vi.mock("@/components/intel/LeadLagExplorer", () => ({ default: () => null }));
afterEach(cleanup);

describe("KPI source provenance", () => {
  it("attributes direct Cass observations to Cass without FRED hosting or vintage claims", async () => {
    render(await KpiPage({ params: Promise.resolve({ projectId: "freight" }), searchParams: Promise.resolve({ kpi: "cass-linehaul" }) }));
    const source = screen.getByText(/Cass Information Systems \(direct public release\), series CASS_LINEHAUL/);
    expect(source).not.toHaveTextContent("via FRED");
    expect(screen.getByText("Published / updated by source")).toBeInTheDocument();
    expect(screen.getByText(/Selected levels from Cass's public historical workbook/)).toBeInTheDocument();
    expect(screen.getByText(/gap\(s\) in the monthly record from 2025-09-01/)).toBeInTheDocument();
    expect(screen.queryByText(/FRED shows the latest vintage/)).not.toBeInTheDocument();
  });

  it("retains the actual FRED publisher and vintage caveat for FRED-hosted series", async () => {
    render(await KpiPage({ params: Promise.resolve({ projectId: "freight" }), searchParams: Promise.resolve({ kpi: "truck-tonnage" }) }));
    expect(screen.getByText("Published (FRED updated)")).toBeInTheDocument();
    expect(screen.getByText(/FRED shows the latest vintage/)).toBeInTheDocument();
  });
});
