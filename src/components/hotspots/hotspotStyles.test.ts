import { describe, expect, it } from "vitest";
import { confidenceBand, formatPrior } from "./hotspotStyles";

describe("hotspot display helpers", () => {
  it("shows configured priors to the nearest 5% with a tilde", () => {
    expect(formatPrior(0.326)).toBe("~35%");
    expect(formatPrior(0.45)).toBe("~45%");
    expect(formatPrior(0.211)).toBe("~20%");
  });

  it("maps heuristic confidence scores to bands", () => {
    expect(confidenceBand(80).label).toBe("Higher");
    expect(confidenceBand(50).label).toBe("Moderate");
    expect(confidenceBand(20).label).toBe("Lower");
  });
});
