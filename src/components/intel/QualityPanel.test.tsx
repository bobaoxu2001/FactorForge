import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import QualityPanel from "./QualityPanel";
import { EMPTY_WORKSPACE, type ScenarioProbability, type WorkspaceState } from "@/lib/intel/workspace";

const workspace = vi.hoisted(() => ({ state: null as WorkspaceState | null }));
vi.mock("./useWorkspace", () => ({ useWorkspace: () => ({ state: workspace.state, ready: true }) }));

afterEach(() => { cleanup(); workspace.state = null; });

const saved = (ticker: string): ScenarioProbability => ({ ticker, probabilities: { bull: 0.2, base: 0.5, bear: 0.3 }, justification: "Assumptions are documented with supporting research.", updatedAt: "2026-11-12" });
const renderPanel = (tickers: string[]) => {
  workspace.state = { ...EMPTY_WORKSPACE, scenarioProbabilities: Object.fromEntries(tickers.map((ticker) => [ticker, saved(ticker)])) };
  render(<QualityPanel checks={[{ id: "valuation-assumptions", label: "Valuation assumptions documented", state: "warn", detail: "" }]} projectId="freight" focusTickers={["KNX", "JBHT", "CHRW"]} />);
};

describe("QualityPanel", () => {
  it("keeps unrelated probability sets from promoting required focus coverage to pass", () => {
    renderPanel(["ODFL", "SNDR", "WERN"]);
    expect(screen.getByText("warn")).toBeInTheDocument();
    expect(screen.getByText(/0 of 3 focus companies/)).toHaveTextContent("Still required: KNX, JBHT, CHRW");
  });

  it("shows remaining names until all configured focus companies have valid assumptions", () => {
    renderPanel(["KNX", "JBHT"]);
    expect(screen.getByText(/2 of 3 focus companies/)).toHaveTextContent("Still required: CHRW");
    cleanup();
    renderPanel(["KNX", "JBHT", "CHRW"]);
    expect(screen.getByText("pass")).toBeInTheDocument();
    expect(screen.getByText(/3 of 3 focus companies/)).toHaveTextContent("not verified forecasts");
  });
});
