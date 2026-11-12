import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PrimaryResearchWorkspace from "./PrimaryResearchWorkspace";
import WorkspaceSummary from "./WorkspaceSummary";
import WorkspaceStorageNotice from "./WorkspaceStorageNotice";

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

describe("research workspace shared across real panels", () => {
  it("retains invalid form input and shares a valid in-memory save when storage is full", () => {
    localStorage.clear();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Quota exceeded", "QuotaExceededError"); });
    render(<>
      <WorkspaceStorageNotice projectId="freight" />
      <PrimaryResearchWorkspace projectId="freight" stakeholders={[{ id: "carrier", label: "Carrier", why: "Capacity", hypothesisIds: [], questions: [], cautions: [] }]} />
      <WorkspaceSummary projectId="freight" />
    </>);
    const notes = screen.getByRole("textbox", { name: "Notes" });
    fireEvent.change(notes, { target: { value: "Spot prices were flat this month." } });
    fireEvent.change(screen.getByRole("combobox", { name: "Verification status" }), { target: { value: "verified" } });
    fireEvent.click(screen.getByRole("button", { name: "Save interview" }));
    expect(screen.getByText(/A verified interview needs a document reference/)).toBeInTheDocument();
    expect(notes).toHaveValue("Spot prices were flat this month.");
    expect(screen.getByRole("heading", { name: "Your interviews (0)" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Verification status" }), { target: { value: "unverified" } });
    fireEvent.click(screen.getByRole("button", { name: "Save interview" }));
    expect(screen.getByRole("heading", { name: "Your interviews (1)" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Browser storage is unavailable");
    expect(within(screen.getByRole("link", { name: /Interviews recorded/ })).getByText("1")).toBeInTheDocument();
    expect(notes).toHaveValue("");
  });
});
