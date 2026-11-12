import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_WORKSPACE, workspaceReducer, type WorkspaceAction } from "@/lib/intel/workspace";
import PrimaryResearchWorkspace from "./PrimaryResearchWorkspace";

const mock = vi.hoisted(() => ({ dispatch: vi.fn(), ready: true }));
vi.mock("./useWorkspace", () => ({
  useWorkspace: () => ({ state: EMPTY_WORKSPACE, ready: mock.ready, persisted: true, dispatch: mock.dispatch }),
}));

afterEach(cleanup);
beforeEach(() => { mock.dispatch.mockReset().mockReturnValue(null); mock.ready = true; });

function importFile(contents: unknown) {
  const file = { text: async () => JSON.stringify(contents) };
  fireEvent.change(screen.getByLabelText("Import workspace JSON"), { target: { files: [file] } });
}

describe("workspace file import", () => {
  it("dispatches a merge rather than replacing current research records", async () => {
    render(<PrimaryResearchWorkspace projectId="freight" stakeholders={[]} />);
    importFile({ version: 1, memoEdits: { freight: { "industry-background": "Imported research note" } } });
    await waitFor(() => expect(mock.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: "import",
      state: expect.objectContaining({ memoEdits: { freight: { "industry-background": "Imported research note" } } }),
    })));
    expect(screen.getByText(/Workspace merged:/)).toHaveTextContent(/Existing entries were kept on conflicts/);
  });

  it("does not dispatch unrelated JSON or a newer unsupported workspace", async () => {
    render(<PrimaryResearchWorkspace projectId="freight" stakeholders={[]} />);
    importFile({ unrelated: "JSON" });
    await screen.findByText(/Choose a supported FactorForge workspace export/);
    expect(mock.dispatch).not.toHaveBeenCalled();
    importFile({ version: 99, interviews: [] });
    await waitFor(() => expect(screen.getByText(/Choose a supported FactorForge workspace export/)).toBeInTheDocument());
    expect(mock.dispatch).not.toHaveBeenCalled();
  });

  it("keeps import and export unavailable until local records have loaded", () => {
    mock.ready = false;
    render(<PrimaryResearchWorkspace projectId="freight" stakeholders={[]} />);
    expect(screen.getByRole("button", { name: "Export workspace (JSON)" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Import…" })).toBeDisabled();
  });

  it.each(["change", "input"] as const)("preserves interview text when a cleared date emits %s", (event) => {
    mock.dispatch.mockImplementation((action: WorkspaceAction) => {
      try { workspaceReducer(EMPTY_WORKSPACE, action); return null; }
      catch (error) { return error instanceof Error ? error.message : String(error); }
    });
    render(<PrimaryResearchWorkspace projectId="freight" stakeholders={[{ id: "carrier", label: "Carrier", why: "Direct market observations", hypothesisIds: [], questions: [], cautions: [] }]} />);
    fireEvent[event](screen.getByLabelText("Interview date"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Spot rates stayed flat this month." } });
    fireEvent.click(screen.getByRole("button", { name: "Save interview" }));
    expect(screen.getByText("Choose a valid interview date.")).toBeInTheDocument();
    expect(screen.getByLabelText("Notes")).toHaveValue("Spot rates stayed flat this month.");
  });
});
