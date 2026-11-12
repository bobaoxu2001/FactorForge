import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_WORKSPACE } from "@/lib/intel/workspace";
import type { Evidence } from "@/lib/intel/types";
import EvidenceExplorer from "./EvidenceExplorer";

vi.mock("./useWorkspace", () => ({ useWorkspace: () => ({ state: EMPTY_WORKSPACE, ready: true, dispatch: vi.fn() }) }));
afterEach(cleanup);

const evidence = (id: string, status: Evidence["status"]): Evidence => ({
  id, projectId: "freight", subject: `Subject ${id}`, claim: `Claim ${id}`, origin: "public-secondary", status,
  source: { id, title: `Source ${id}`, publisher: "Public source", sourceType: "government-dataset", retrievedAt: "2026-11-03T00:00:00Z" },
  retrievedAt: "2026-11-03T00:00:00Z", confidence: "low", confidenceRationale: "Limited coverage", kpiIds: [], tickers: [], hypothesisIds: [], stance: {},
});

describe("evidence selection and filters", () => {
  it("moves the detail pane to matching evidence when the selected record is filtered out", () => {
    render(<EvidenceExplorer projectId="freight" evidence={[evidence("EV-A", "verified"), evidence("EV-B", "unverified")]} hypotheses={[]} memoCitations={{}} initialId="EV-A" />);
    expect(within(screen.getByRole("article")).getByText("Subject EV-A")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "unverified" } });
    expect(within(screen.getByRole("article")).getByText("Subject EV-B")).toBeInTheDocument();
    expect(screen.queryByText("Subject EV-A")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { pressed: true })).toHaveTextContent("EV-B");
  });

  it("clears the detail and note editor when no evidence matches", () => {
    render(<EvidenceExplorer projectId="freight" evidence={[evidence("EV-A", "verified")]} hypotheses={[]} memoCitations={{}} initialId="EV-A" />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search evidence" }), { target: { value: "no-match-anywhere" } });
    expect(screen.getByText("No evidence matches these filters.")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Your note/ })).not.toBeInTheDocument();
  });
});
