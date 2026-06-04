import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ProtectedRouteExplainer from "./ProtectedRouteExplainer";

describe("ProtectedRouteExplainer", () => {
  it("explains protected public-demo areas without implying brokerage access", () => {
    render(<ProtectedRouteExplainer area="watchlist" />);
    expect(screen.getByText(/This area is optional/i)).toBeInTheDocument();
    expect(screen.getByText(/public demo keeps personal watchlists protected/i)).toBeInTheDocument();
    expect(screen.getByText(/does not connect to brokers or place trades/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Continue exploring public demo/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /OSS & Maintainers/i })).toHaveAttribute("href", "/oss");
  });
});
