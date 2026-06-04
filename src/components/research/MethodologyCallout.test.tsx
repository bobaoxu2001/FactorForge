import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MethodologyCallout from "./MethodologyCallout";

describe("MethodologyCallout", () => {
  it("renders methodology assumptions compactly", () => {
    render(<MethodologyCallout items={["Next-open execution", "No intraday fills"]} />);
    expect(screen.getByText("Methodology / Assumptions")).toBeInTheDocument();
    expect(screen.getByText("Next-open execution")).toBeInTheDocument();
    expect(screen.getByText("No intraday fills")).toBeInTheDocument();
  });
});
