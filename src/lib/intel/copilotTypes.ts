/**
 * Copilot request/response contract, kept free of analysis code so client
 * components can import it without bundling the server-side engine.
 */

export const COPILOT_TASKS = [
  { id: "research-plan", label: "Industry research plan" },
  { id: "hypotheses", label: "Propose & test hypotheses" },
  { id: "evidence-check", label: "Supporting vs contradicting evidence" },
  { id: "leading-indicators", label: "Leading indicators" },
  { id: "compare", label: "Compare competitors" },
  { id: "explain-financials", label: "Explain a company's results" },
  { id: "interview-guide", label: "Channel-check interview guide" },
  { id: "notes-analysis", label: "Analyse my interview notes" },
  { id: "kpi-extract", label: "Extract KPIs from text" },
  { id: "memo-draft", label: "Draft memo summary" },
  { id: "missing-evidence", label: "What evidence is missing?" },
  { id: "invalidation", label: "Thesis invalidation conditions" },
  { id: "follow-ups", label: "Recommend follow-up research" },
  { id: "question", label: "Ask a question" },
] as const;

export type CopilotTask = (typeof COPILOT_TASKS)[number]["id"];

export interface CopilotRequest {
  projectId: string;
  task: CopilotTask;
  question?: string;
  hypothesisId?: string;
  ticker?: string;
  stakeholderId?: string;
  /** User-provided text (notes, a pasted document). Sent to an LLM only with allowAi. */
  text?: string;
  allowAi?: boolean;
}

export interface Statement {
  text: string;
  evidenceIds: string[];
}

export interface CopilotResponse {
  task: CopilotTask;
  source: "deepseek" | "deterministic";
  facts: Statement[];
  calculations: Statement[];
  interpretation: Statement[];
  hypotheses: Statement[];
  missing: Statement[];
  followUps: string[];
  unsupported: Statement[];
  retrieved: Array<{ id: string; claim: string; publisher: string; status: string; origin: string }>;
  warnings: string[];
  /** Work product of this request is AI/template generated and is never evidence. */
  origin: "ai-generated" | "template-generated";
}

