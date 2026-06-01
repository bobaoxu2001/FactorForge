import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Term from "./Term";

describe("<Term>", () => {
  // This project's vitest setup doesn't auto-clean between tests, and several
  // cases render the same term, so unmount explicitly to avoid duplicate DOM.
  afterEach(() => cleanup());

  it("shows the glossary term name as the default label", () => {
    render(<Term term="sharpe" />);
    expect(screen.getByRole("button", { name: /sharpe ratio/i })).toBeInTheDocument();
  });

  it("uses custom children as the visible label when provided", () => {
    render(<Term term="sharpe">risk-adjusted return</Term>);
    expect(screen.getByRole("button", { name: /risk-adjusted return/i })).toBeInTheDocument();
  });

  it("reveals the plain-English explanation on click", async () => {
    const user = userEvent.setup();
    render(<Term term="drawdown" />);
    // Tooltip not shown until interaction.
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /max drawdown/i }));
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent(/worst peak-to-bottom drop/i);
    expect(tip).toHaveTextContent(/why it matters/i);
  });

  it("falls back to plain text for an unknown term (no tooltip, no crash)", () => {
    render(<Term term="not-a-real-term">just text</Term>);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("just text")).toBeInTheDocument();
  });

  it("resolves aliases to the canonical entry", async () => {
    const user = userEvent.setup();
    render(<Term term="n_eff" />);
    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("tooltip")).toHaveTextContent(/genuinely different bets/i);
  });
});
