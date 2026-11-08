import type { EventCategory } from "./types";

/**
 * Event categories. Adding one means adding a key to EventCategory and a row
 * here; nothing else in the engine branches on category, so a new kind of
 * event (an export restriction, a rate shock) needs no new code paths.
 */
export const EVENT_CATEGORIES: Record<EventCategory, { label: string; examples: string }> = {
  "cyber-breach": { label: "Cyber breach", examples: "Exchange hacks, ransomware, data theft" },
  "ai-security": { label: "AI security", examples: "Compromised AI tools or agents, model abuse" },
  "policy-regulation": { label: "Policy & regulation", examples: "Rules, orders, enforcement" },
  election: { label: "Election", examples: "Results that change policy expectations" },
  "ai-datacenter-restriction": { label: "Data-center restriction", examples: "Moratoria, permit pauses, siting rules" },
  "infrastructure-constraint": { label: "Infrastructure constraint", examples: "Power, grid, water, permitting bottlenecks" },
  "earnings-guidance": { label: "Earnings & guidance", examples: "Surprises, capex and revenue guidance" },
  "macro-rates-liquidity": { label: "Rates & liquidity", examples: "Policy rates, inflation, credit conditions" },
  "supply-chain": { label: "Supply chain", examples: "Shortages, export controls, logistics" },
  "industry-pricing-demand": { label: "Industry pricing & demand", examples: "Pricing, capacity, inventory shifts" },
  geopolitical: { label: "Geopolitical", examples: "Conflict, sanctions, trade measures" },
  "company-operational": { label: "Company operations", examples: "Outages, recalls, incidents" },
  "market-dislocation": { label: "Market dislocation", examples: "Crashes, squeezes, liquidity events" },
};
