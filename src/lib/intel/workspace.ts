import type { ScenarioCase, VerificationStatus } from "./types";

/**
 * The user's research workspace: everything a person adds on top of the
 * public snapshot. Pure state + reducer so it can live in localStorage today
 * and behind an API tomorrow without changing callers.
 *
 * Provenance is part of the type: interview records are `user-primary`;
 * copilot drafts saved here are `ai-generated` and can never be promoted to
 * evidence. A user may attest that a note is verified only by attaching a
 * document reference.
 */

export const WORKSPACE_VERSION = 1;
export const WORKSPACE_STORAGE_KEY = "factorforge.workspace.v1";

export interface InterviewRecord {
  id: string;
  projectId: string;
  origin: "user-primary";
  stakeholderId: string;
  /** How the source is described, e.g. "Regional reefer carrier owner, 40 trucks". Never a name by default. */
  sourceDescription: string;
  interviewDate: string;
  consentToQuote: boolean;
  notes: string;
  status: Extract<VerificationStatus, "unverified" | "partially-verified" | "verified" | "contradicted">;
  /** Required for "verified": e.g. a reference to your call notes file. */
  documentRef?: string;
  /** Flags the user acknowledged when saving (MNPI/PII screen). */
  acknowledgedFlags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SavedDraft {
  id: string;
  projectId: string;
  origin: "ai-generated";
  task: string;
  title: string;
  body: string;
  createdAt: string;
}

export interface ScenarioProbability {
  ticker: string;
  probabilities: Record<ScenarioCase, number | null>;
  justification: string;
  updatedAt: string;
}

export interface ThesisRecord {
  projectId: string;
  /** Date the thesis was adopted; outcome review measures from here. */
  adoptedOn: string | null;
  summary: string;
  outcomeNotes: string;
}

export interface WorkspaceState {
  version: number;
  interviews: InterviewRecord[];
  drafts: SavedDraft[];
  scenarioProbabilities: Record<string, ScenarioProbability>;
  memoEdits: Record<string, Record<string, string>>;
  evidenceNotes: Record<string, string>;
  thesis: Record<string, ThesisRecord>;
}

export const EMPTY_WORKSPACE: WorkspaceState = {
  version: WORKSPACE_VERSION,
  interviews: [],
  drafts: [],
  scenarioProbabilities: {},
  memoEdits: {},
  evidenceNotes: {},
  thesis: {},
};

export type WorkspaceAction =
  | { type: "interview/save"; record: InterviewRecord }
  | { type: "interview/delete"; id: string }
  | { type: "draft/save"; draft: SavedDraft }
  | { type: "draft/delete"; id: string }
  | { type: "scenario/set"; value: ScenarioProbability }
  | { type: "memo/edit"; projectId: string; sectionId: string; text: string }
  | { type: "memo/reset"; projectId: string; sectionId: string }
  | { type: "evidence/note"; evidenceId: string; note: string }
  | { type: "thesis/set"; value: ThesisRecord }
  | { type: "replace"; state: WorkspaceState };

export class WorkspaceValidationError extends Error {}

function assertInterview(record: InterviewRecord): void {
  if (record.origin !== "user-primary") throw new WorkspaceValidationError("Interview records must be user-primary research.");
  if (record.status === "verified" && !record.documentRef?.trim()) {
    throw new WorkspaceValidationError("A verified interview needs a document reference (e.g., your call notes file).");
  }
  if (!record.notes.trim()) throw new WorkspaceValidationError("Interview notes are empty.");
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "interview/save": {
      assertInterview(action.record);
      const others = state.interviews.filter((r) => r.id !== action.record.id);
      return { ...state, interviews: [...others, action.record].sort((a, b) => b.interviewDate.localeCompare(a.interviewDate)) };
    }
    case "interview/delete":
      return { ...state, interviews: state.interviews.filter((r) => r.id !== action.id) };
    case "draft/save":
      if (action.draft.origin !== "ai-generated") throw new WorkspaceValidationError("Saved drafts are AI-generated work product.");
      return { ...state, drafts: [action.draft, ...state.drafts.filter((d) => d.id !== action.draft.id)].slice(0, 50) };
    case "draft/delete":
      return { ...state, drafts: state.drafts.filter((d) => d.id !== action.id) };
    case "scenario/set": {
      const values = Object.values(action.value.probabilities);
      const anySet = values.some((v) => v !== null);
      if (anySet && action.value.justification.trim().length < 20) {
        throw new WorkspaceValidationError("Scenario probabilities need a written justification (at least a sentence).");
      }
      if (values.some((v) => v !== null && (v < 0 || v > 1))) throw new WorkspaceValidationError("Probabilities must be between 0% and 100%.");
      return { ...state, scenarioProbabilities: { ...state.scenarioProbabilities, [action.value.ticker]: action.value } };
    }
    case "memo/edit": {
      const project = { ...(state.memoEdits[action.projectId] ?? {}), [action.sectionId]: action.text };
      return { ...state, memoEdits: { ...state.memoEdits, [action.projectId]: project } };
    }
    case "memo/reset": {
      const project = { ...(state.memoEdits[action.projectId] ?? {}) };
      delete project[action.sectionId];
      return { ...state, memoEdits: { ...state.memoEdits, [action.projectId]: project } };
    }
    case "evidence/note":
      return { ...state, evidenceNotes: { ...state.evidenceNotes, [action.evidenceId]: action.note } };
    case "thesis/set":
      return { ...state, thesis: { ...state.thesis, [action.value.projectId]: action.value } };
    case "replace":
      return migrateWorkspace(action.state);
    default:
      return state;
  }
}

/**
 * Accept anything that came out of storage or an import file and return a
 * valid current-version state. Unknown or malformed fields are dropped, never
 * trusted. Interview records that would violate provenance rules are removed.
 */
export function migrateWorkspace(input: unknown): WorkspaceState {
  if (!input || typeof input !== "object") return { ...EMPTY_WORKSPACE };
  const raw = input as Partial<WorkspaceState> & { version?: number };
  const interviews = Array.isArray(raw.interviews)
    ? raw.interviews.filter((r): r is InterviewRecord => {
        try {
          if (!r || typeof r !== "object" || typeof r.id !== "string" || typeof r.notes !== "string") return false;
          assertInterview({ ...r, origin: "user-primary" });
          return r.origin === "user-primary";
        } catch {
          return false;
        }
      })
    : [];
  const drafts = Array.isArray(raw.drafts) ? raw.drafts.filter((d) => d && d.origin === "ai-generated" && typeof d.body === "string") : [];
  const obj = <T>(value: unknown): Record<string, T> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, T>) : {});
  return {
    version: WORKSPACE_VERSION,
    interviews,
    drafts,
    scenarioProbabilities: obj<ScenarioProbability>(raw.scenarioProbabilities),
    memoEdits: obj<Record<string, string>>(raw.memoEdits),
    evidenceNotes: obj<string>(raw.evidenceNotes),
    thesis: obj<ThesisRecord>(raw.thesis),
  };
}

export function serializeWorkspace(state: WorkspaceState): string {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString(), note: "FactorForge research workspace export. Contains your private notes." }, null, 2);
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
