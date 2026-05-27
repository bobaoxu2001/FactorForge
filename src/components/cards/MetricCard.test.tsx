import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MetricCard from "./MetricCard";

describe("MetricCard", () => {
  it("renders label and value", () => {
    render(<MetricCard label="Sharpe" value="1.42" />);
    expect(screen.getByText("Sharpe")).toBeInTheDocument();
    expect(screen.getByText("1.42")).toBeInTheDocument();
  });

  it("uses the positive tone class when tone='positive'", () => {
    render(<MetricCard label="Return" value="12.0%" tone="positive" />);
    expect(screen.getByText("12.0%").className).toMatch(/brand-green/);
  });

  it("renders an optional hint", () => {
    render(<MetricCard label="Total" value="$100" hint="across all legs" />);
    expect(screen.getByText("across all legs")).toBeInTheDocument();
  });
});
