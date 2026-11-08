import type { Stage } from "@/components/intel/StageNav";

/**
 * Local navigation for an event case. The brief is the entry point; the case
 * root ("") stays the Updates page so existing links and bookmarks keep working.
 */
export function caseStages(counts: { confirmed: number; claims: number; windows: number }): Stage[] {
  return [
    { slug: "brief", label: "Brief", step: "" },
    { slug: "impact", label: "Business impact", step: "" },
    { slug: "evidence", label: "Evidence", step: "", status: `${counts.confirmed}/${counts.claims} confirmed` },
    { slug: "", label: "Updates", step: "" },
    { slug: "market", label: "Market reaction", step: "", status: `${counts.windows} windows`, secondary: true },
    { slug: "scenarios", label: "Scenarios", step: "", secondary: true },
    { slug: "memo", label: "Memo", step: "", secondary: true },
  ];
}
