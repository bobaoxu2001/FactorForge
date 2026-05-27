import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StatusBadge from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders the literal status text", () => {
    render(<StatusBadge status="within limits" />);
    expect(screen.getByText("within limits")).toBeInTheDocument();
  });

  it("uses the green styling for the new idle state", () => {
    render(<StatusBadge status="idle" />);
    const badge = screen.getByText("idle");
    expect(badge.className).toMatch(/emerald/);
  });

  it("uses the rose styling for paused", () => {
    render(<StatusBadge status="paused" />);
    const badge = screen.getByText("paused");
    expect(badge.className).toMatch(/rose/);
  });

  it("uses the rose styling for rejected verdicts", () => {
    render(<StatusBadge status="rejected" />);
    expect(screen.getByText("rejected").className).toMatch(/rose/);
  });
});
