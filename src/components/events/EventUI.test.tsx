import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ALL_CLAIMS, ALL_SOURCES } from "@/data/events";
import { verifyClaim } from "@/lib/events/verification";
import { ClaimCard, CitedProse, EvidenceRefs, OriginChip, When } from "./EventUI";

const NOW = Date.parse("2026-11-08T04:00:00Z");
const sources = new Map(ALL_SOURCES.map((s) => [s.id, s]));
const view = (id: string) => verifyClaim(ALL_CLAIMS.find((c) => c.id === id)!, ALL_SOURCES, NOW)!;

describe("source traceability in the UI", () => {
  it("links every citation of a claim to its original source", () => {
    const claim = view("A-C16");
    render(<ClaimCard claim={claim} sources={sources} />);
    for (const c of claim.citations) {
      const s = sources.get(c.sourceId)!;
      const links = screen.getAllByRole("link", { name: s.publisher });
      expect(links.some((a) => a.getAttribute("href") === s.url)).toBe(true);
    }
    expect(screen.getByText("disputed")).toBeInTheDocument();
    expect(screen.getByText(/· contradicts/)).toBeInTheDocument();
  });

  it("marks unread sources as unread", () => {
    render(<ClaimCard claim={view("B-C19")} sources={sources} />);
    expect(screen.getByText(/not read \(blocked\)/)).toBeInTheDocument();
    expect(screen.getAllByText(/second-hand/).length).toBeGreaterThan(0);
  });

  it("shows the lifecycle guard on an unconfirmed enactment", () => {
    render(<ClaimCard claim={view("A-C07")} sources={sources} />);
    expect(screen.getByText("proposed (guarded)")).toBeInTheDocument();
    expect(screen.getByText(/no official source confirms it/)).toBeInTheDocument();
  });

  it("turns [ID] citations in prose into links to the evidence page", () => {
    render(<CitedProse text="Frozen is not recovered [B-C05]." caseSlug="binance-breach" />);
    expect(screen.getByRole("link", { name: "B-C05" })).toHaveAttribute("href", "/events/binance-breach/evidence#B-C05");
  });

  it("links market and exposure references to their pages", () => {
    render(<EvidenceRefs ids={["MKT:W-B-EQ:COIN", "EXP:COIN:directRevenue"]} caseSlug="binance-breach" />);
    expect(screen.getByRole("link", { name: /market: COIN/ })).toHaveAttribute("href", "/events/binance-breach/market#W-B-EQ");
    expect(screen.getByRole("link", { name: /exposure: COIN/ })).toHaveAttribute("href", "/events/binance-breach/impact#exposure");
  });

  it("labels backfilled work so it cannot pass for a track record", () => {
    render(<OriginChip origin="backfill" />);
    expect(screen.getByText("backfill")).toHaveAttribute("title", expect.stringMatching(/not a track record/));
  });

  it("shows a day-precision date as its local calendar date", () => {
    render(<When iso="2026-07-14T23:59:00-04:00" precision="day" />);
    expect(screen.getByText("Jul 14, 2026")).toBeInTheDocument();
  });
});
