import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import DemoModeNotice from "./DemoModeNotice";

afterEach(() => cleanup());

describe("DemoModeNotice", () => {
  it("explains disabled account creation without a scary persistence error (sign-up)", () => {
    render(<DemoModeNotice mode="sign-up" />);
    expect(screen.getByText(/Account creation is disabled in the public demo/i)).toBeInTheDocument();
    expect(screen.getByText(/require a local or configured database deployment/i)).toBeInTheDocument();
    expect(screen.getByText(/explore all public research pages without signing in/i)).toBeInTheDocument();
    expect(screen.getByText(/does not connect to brokers, place trades/i)).toBeInTheDocument();
    // The raw engine string must never reach the user.
    expect(screen.queryByText(/Persistence layer unavailable/i)).toBeNull();
  });

  it("links a demo visitor back into the read-only research surface (sign-up)", () => {
    render(<DemoModeNotice mode="sign-up" />);
    expect(screen.getByRole("link", { name: /Continue exploring public demo/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /View OSS & Maintainers/i })).toHaveAttribute("href", "/oss");
    expect(screen.getByRole("link", { name: /Read local setup docs/i })).toHaveAttribute(
      "href",
      expect.stringContaining("github.com"),
    );
  });

  it("explains disabled sign-in and lists usable research pages (sign-in)", () => {
    render(<DemoModeNotice mode="sign-in" />);
    expect(screen.getByText(/Sign-in is disabled in the public demo/i)).toBeInTheDocument();
    expect(screen.getByText(/only for saved research preferences and watchlists/i)).toBeInTheDocument();
    expect(screen.getByText(/Overview, Data, Factors, Strategies, Radar, Consensus, Portfolio/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Continue exploring public demo/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /^Reports$/i })).toHaveAttribute("href", "/reports");
    expect(screen.getByRole("link", { name: /View OSS & Maintainers/i })).toHaveAttribute("href", "/oss");
    expect(screen.queryByText(/Persistence layer unavailable/i)).toBeNull();
  });

  it("adds protected-route context when an area is passed", () => {
    render(<DemoModeNotice mode="sign-in" area="watchlist" />);
    expect(screen.getByText(/requires saved-preference storage \(personal watchlists\)/i)).toBeInTheDocument();
    expect(screen.getByText(/local setup with SQLite or a configured persistence backend/i)).toBeInTheDocument();
    expect(screen.getByText(/read-only for safety/i)).toBeInTheDocument();
  });

  it("labels the admin cache area", () => {
    render(<DemoModeNotice mode="sign-in" area="cache" />);
    expect(screen.getByText(/requires saved-preference storage \(admin cache controls\)/i)).toBeInTheDocument();
  });
});
