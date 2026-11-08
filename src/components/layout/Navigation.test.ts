// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NAV_SECTIONS, activeHref, sectionOpen } from "./Navigation";

const items = NAV_SECTIONS.flatMap((s) => s.items);
const item = (label: string) => items.find((i) => i.label === label)!;

describe("sidebar case entries", () => {
  it("opens event cases on their brief and the freight case on its introduction", () => {
    expect(item("AI data-center restrictions").href).toBe("/events/ai-datacenter-shock/brief");
    expect(item("Binance breach").href).toBe("/events/binance-breach/brief");
    expect(item("Freight recovery").href).toBe("/research/freight");
  });

  it("keeps a case highlighted on every case page, including the Updates root", () => {
    for (const sub of ["", "/brief", "/impact", "/evidence", "/market", "/scenarios", "/memo"]) {
      expect(activeHref(`/events/ai-datacenter-shock${sub}`), sub || "root").toBe("/events/ai-datacenter-shock/brief");
      expect(activeHref(`/events/binance-breach${sub}`), sub || "root").toBe("/events/binance-breach/brief");
    }
  });

  it("leaves other routes highlighted as before", () => {
    expect(activeHref("/events")).toBe("/events");
    expect(activeHref("/research/freight")).toBe("/research/freight");
    expect(activeHref("/research/freight/evidence")).toBe("/research/freight/evidence");
    expect(activeHref("/theses")).toBe("/theses");
    expect(activeHref("/quant")).toBe("/quant");
    expect(activeHref("/")).toBe("/");
  });

  it("opens the labs group only when the current page is in it", () => {
    const labs = NAV_SECTIONS.find((s) => s.label === "Methods & labs")!;
    expect(sectionOpen(labs, "/events/ai-datacenter-shock/brief")).toBe(false);
    expect(sectionOpen(labs, "/quant")).toBe(true);
  });
});
