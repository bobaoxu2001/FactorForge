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
  origin: "ai-generated" | "template-generated";
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
  | { type: "import"; state: WorkspaceState }
  | { type: "replace"; state: WorkspaceState };

export class WorkspaceValidationError extends Error {}

function assertInterview(record: InterviewRecord): void {
  if (![record.id, record.projectId, record.stakeholderId].every(isKey)) throw new WorkspaceValidationError("Interview, project and stakeholder identifiers are required.");
  if (record.origin !== "user-primary") throw new WorkspaceValidationError("Interview records must be user-primary research.");
  if (!isDay(record.interviewDate)) throw new WorkspaceValidationError("Choose a valid interview date.");
  if (!isTimestamp(record.createdAt) || !isTimestamp(record.updatedAt)) throw new WorkspaceValidationError("Interview creation and update dates must be valid.");
  if (typeof record.sourceDescription !== "string" || typeof record.notes !== "string") throw new WorkspaceValidationError("Interview source and notes must be text.");
  if (typeof record.consentToQuote !== "boolean" || !Array.isArray(record.acknowledgedFlags) || !record.acknowledgedFlags.every((flag) => typeof flag === "string")) throw new WorkspaceValidationError("Interview consent and acknowledged flags are invalid.");
  if (!["unverified", "partially-verified", "verified", "contradicted"].includes(record.status)) throw new WorkspaceValidationError("Choose a valid interview verification status.");
  if (record.documentRef !== undefined && typeof record.documentRef !== "string") throw new WorkspaceValidationError("The document reference must be text.");
  if (record.status === "verified" && !record.documentRef?.trim()) {
    throw new WorkspaceValidationError("A verified interview needs a document reference (e.g., your call notes file).");
  }
  if (!record.notes.trim()) throw new WorkspaceValidationError("Interview notes are empty.");
}

function assertDraft(draft: SavedDraft): void {
  if (draft.origin !== "ai-generated" && draft.origin !== "template-generated") throw new WorkspaceValidationError("Saved drafts are AI or template-generated work product.");
  if (!isKey(draft.id) || !isKey(draft.projectId)) throw new WorkspaceValidationError("Draft and project identifiers are required.");
  if (![draft.task, draft.title, draft.body].every((value) => typeof value === "string")) throw new WorkspaceValidationError("Draft task, title and body must be text.");
  if (!isTimestamp(draft.createdAt)) throw new WorkspaceValidationError("The draft creation date must be valid.");
}

function assertScenario(value: ScenarioProbability): void {
  if (!isKey(value.ticker)) throw new WorkspaceValidationError("A scenario ticker is required.");
  const probabilities = object(value.probabilities);
  const values = [probabilities.bull, probabilities.base, probabilities.bear];
  if (Object.keys(probabilities).length !== 3 || values.some((probability) => probability !== null && (typeof probability !== "number" || !Number.isFinite(probability) || probability < 0 || probability > 1))) {
    throw new WorkspaceValidationError("Bull, base and bear probabilities must be blank or between 0% and 100%.");
  }
  if (typeof value.justification !== "string" || (values.some((probability) => probability !== null) && value.justification.trim().length < 20)) {
    throw new WorkspaceValidationError("Scenario probabilities need a written justification (at least a sentence).");
  }
  if (!isTimestamp(value.updatedAt)) throw new WorkspaceValidationError("The scenario update date must be valid.");
}

function assertThesis(value: ThesisRecord): void {
  if (!isKey(value.projectId)) throw new WorkspaceValidationError("A thesis project identifier is required.");
  if (value.adoptedOn !== null && !isDay(value.adoptedOn)) throw new WorkspaceValidationError("Choose a valid thesis adoption date, or leave it blank.");
  if (typeof value.summary !== "string" || typeof value.outcomeNotes !== "string") throw new WorkspaceValidationError("Thesis summary and outcome notes must be text.");
}

function assertTextEntry(key: string, value: string): void {
  if (!isKey(key) || typeof value !== "string") throw new WorkspaceValidationError("A valid record identifier and text are required.");
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
      assertDraft(action.draft);
      return { ...state, drafts: [action.draft, ...state.drafts.filter((d) => d.id !== action.draft.id)].slice(0, 50) };
    case "draft/delete":
      return { ...state, drafts: state.drafts.filter((d) => d.id !== action.id) };
    case "scenario/set": {
      assertScenario(action.value);
      return { ...state, scenarioProbabilities: { ...state.scenarioProbabilities, [action.value.ticker]: action.value } };
    }
    case "memo/edit": {
      assertTextEntry(action.projectId, action.text);
      assertTextEntry(action.sectionId, action.text);
      const project = { ...(state.memoEdits[action.projectId] ?? {}), [action.sectionId]: action.text };
      return { ...state, memoEdits: { ...state.memoEdits, [action.projectId]: project } };
    }
    case "memo/reset": {
      const project = { ...(state.memoEdits[action.projectId] ?? {}) };
      delete project[action.sectionId];
      return { ...state, memoEdits: { ...state.memoEdits, [action.projectId]: project } };
    }
    case "evidence/note":
      assertTextEntry(action.evidenceId, action.note);
      return { ...state, evidenceNotes: { ...state.evidenceNotes, [action.evidenceId]: action.note } };
    case "thesis/set":
      assertThesis(action.value);
      return { ...state, thesis: { ...state.thesis, [action.value.projectId]: action.value } };
    case "import":
      return mergeWorkspace(state, migrateWorkspace(action.state));
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
  const raw = object(input);
  const interviews = Array.isArray(raw.interviews)
    ? raw.interviews.filter((r): r is InterviewRecord => {
        try {
          assertInterview(r as InterviewRecord);
          return true;
        } catch {
          return false;
        }
      })
    : [];
  const drafts = Array.isArray(raw.drafts) ? raw.drafts.filter((d): d is SavedDraft => {
    try { assertDraft(d as SavedDraft); return true; } catch { return false; }
  }) : [];
  const scenarios = Object.fromEntries(Object.entries(object(raw.scenarioProbabilities)).filter(([ticker, value]) => {
    const item = object(value);
    if (item.ticker !== ticker) return false;
    try { assertScenario(value as ScenarioProbability); return true; } catch { return false; }
  })) as Record<string, ScenarioProbability>;
  const thesis = Object.fromEntries(Object.entries(object(raw.thesis)).filter(([projectId, value]) => {
    const item = object(value);
    if (item.projectId !== projectId) return false;
    try { assertThesis(value as ThesisRecord); return true; } catch { return false; }
  })) as Record<string, ThesisRecord>;
  return {
    version: WORKSPACE_VERSION,
    interviews: uniqueById(interviews),
    drafts: uniqueById(drafts),
    scenarioProbabilities: scenarios,
    memoEdits: Object.fromEntries(Object.entries(object(raw.memoEdits)).filter(([key]) => isKey(key)).map(([key, value]) => [key, stringMap(value)])),
    evidenceNotes: stringMap(raw.evidenceNotes),
    thesis,
  };
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function isKey(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !["__proto__", "constructor", "prototype"].includes(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && isTimestamp(value) && new Date(value).toISOString().slice(0, 10) === value;
}

function stringMap(value: unknown): Record<string, string> {
  return Object.fromEntries(Object.entries(object(value)).filter(([key, text]) => isKey(key) && typeof text === "string")) as Record<string, string>;
}

/** First valid occurrence wins, matching the non-destructive import policy. */
function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/** Imports add missing records; existing browser entries win every collision. */
export function mergeWorkspace(current: WorkspaceState, imported: WorkspaceState): WorkspaceState {
  const existingInterviews = new Set(current.interviews.map((record) => record.id));
  const existingDrafts = new Set(current.drafts.map((draft) => draft.id));
  const projects = new Set([...Object.keys(imported.memoEdits), ...Object.keys(current.memoEdits)]);
  return {
    version: WORKSPACE_VERSION,
    interviews: uniqueById([...current.interviews, ...imported.interviews.filter((record) => !existingInterviews.has(record.id))]).sort((a, b) => b.interviewDate.localeCompare(a.interviewDate)),
    drafts: uniqueById([...current.drafts, ...imported.drafts.filter((draft) => !existingDrafts.has(draft.id))]),
    scenarioProbabilities: { ...imported.scenarioProbabilities, ...current.scenarioProbabilities },
    memoEdits: Object.fromEntries([...projects].map((projectId) => [projectId, { ...imported.memoEdits[projectId], ...current.memoEdits[projectId] }])),
    evidenceNotes: { ...imported.evidenceNotes, ...current.evidenceNotes },
    thesis: { ...imported.thesis, ...current.thesis },
  };
}

/** Reject unrelated JSON and unsupported exports before anything reaches storage. */
export function parseWorkspaceImport(input: unknown): WorkspaceState {
  const raw = object(input);
  if (!Number.isInteger(raw.version) || Number(raw.version) < 0 || Number(raw.version) > WORKSPACE_VERSION) {
    throw new WorkspaceValidationError("Choose a supported FactorForge workspace export (version 0 or 1).");
  }
  if (!["interviews", "drafts", "scenarioProbabilities", "memoEdits", "evidenceNotes", "thesis"].some((key) => Object.prototype.hasOwnProperty.call(raw, key))) {
    throw new WorkspaceValidationError("This file contains no FactorForge workspace collections.");
  }
  return migrateWorkspace(raw);
}

export function serializeWorkspace(state: WorkspaceState): string {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString(), note: "FactorForge research workspace export. Contains your private notes." }, null, 2);
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
