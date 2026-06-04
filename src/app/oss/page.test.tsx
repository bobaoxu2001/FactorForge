import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OssPage from "./page";

describe("OssPage", () => {
  it("renders maintainer workflow and Codex automation use cases honestly", () => {
    render(<OssPage />);
    expect(screen.getByRole("heading", { name: "OSS & Maintainers" })).toBeInTheDocument();
    expect(screen.getByText(/Generate edge-case tests for backtest math/i)).toBeInTheDocument();
    expect(screen.getByText(/No brokerage credentials should be added/i)).toBeInTheDocument();
    expect(screen.getByText(/not adoption claims/i)).toBeInTheDocument();
  });
});
