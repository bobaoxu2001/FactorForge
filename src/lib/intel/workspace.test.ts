import { describe, expect, it } from "vitest";
import { EMPTY_WORKSPACE, migrateWorkspace, parseWorkspaceImport, serializeWorkspace, workspaceReducer, WorkspaceValidationError, type InterviewRecord, type WorkspaceState } from "./workspace";

const record = (over: Partial<InterviewRecord> = {}): InterviewRecord => ({
  id: "i1",
  projectId: "freight",
  origin: "user-primary",
  stakeholderId: "small-carrier",
  sourceDescription: "Owner of a 12-truck dry-van fleet",
  interviewDate: "2026-10-20",
  consentToQuote: false,
  notes: "Spot rates are flat ex-fuel.",
  status: "unverified",
  acknowledgedFlags: [],
  createdAt: "2026-10-20T00:00:00Z",
  updatedAt: "2026-10-20T00:00:00Z",
  ...over,
});

describe("workspace reducer", () => {
  it("saves user-primary interviews", () => {
    const s = workspaceReducer(EMPTY_WORKSPACE, { type: "interview/save", record: record() });
    expect(s.interviews).toHaveLength(1);
  });
  it("refuses 'verified' without a document reference", () => {
    expect(() => workspaceReducer(EMPTY_WORKSPACE, { type: "interview/save", record: record({ status: "verified" }) })).toThrow(WorkspaceValidationError);
    expect(workspaceReducer(EMPTY_WORKSPACE, { type: "interview/save", record: record({ status: "verified", documentRef: "calls/2026-10-20.pdf" }) }).interviews).toHaveLength(1);
  });
  it("requires a justification for scenario probabilities", () => {
    const value = { ticker: "KNX", probabilities: { bull: 0.3, base: 0.5, bear: 0.2 }, justification: "", updatedAt: "2026-11-12T00:00:00Z" };
    expect(() => workspaceReducer(EMPTY_WORKSPACE, { type: "scenario/set", value })).toThrow(/justification/);
    expect(workspaceReducer(EMPTY_WORKSPACE, { type: "scenario/set", value: { ...value, justification: "Bid season channel checks point to flat contract rates." } }).scenarioProbabilities.KNX).toBeDefined();
  });
  it("only accepts AI drafts as ai-generated work product", () => {
    expect(() => workspaceReducer(EMPTY_WORKSPACE, { type: "draft/save", draft: { id: "d", projectId: "freight", origin: "user-primary" as never, task: "x", title: "t", body: "b", createdAt: "" } })).toThrow();
  });
  it("rejects non-finite scenario probabilities", () => {
    const value = { ticker: "KNX", probabilities: { bull: NaN, base: 0.5, bear: 0.2 }, justification: "Channel checks support these scenario assumptions.", updatedAt: "2026-11-12T00:00:00Z" };
    expect(() => workspaceReducer(EMPTY_WORKSPACE, { type: "scenario/set", value })).toThrow(/between/);
  });
  it("rejects live records that would disappear during the next storage read", () => {
    expect(() => workspaceReducer(EMPTY_WORKSPACE, { type: "interview/save", record: record({ interviewDate: "" }) })).toThrow(/valid interview date/);
    expect(() => workspaceReducer(EMPTY_WORKSPACE, { type: "draft/save", draft: { id: "d", projectId: "freight", origin: "template-generated", task: "research-plan", title: "Draft", body: "A draft", createdAt: "" } })).toThrow(/creation date/);
    expect(() => workspaceReducer(EMPTY_WORKSPACE, { type: "scenario/set", value: { ticker: "KNX", probabilities: { bull: null, base: null, bear: null }, justification: "", updatedAt: "" } })).toThrow(/update date/);
    expect(() => workspaceReducer(EMPTY_WORKSPACE, { type: "thesis/set", value: { projectId: "freight", adoptedOn: "2026-02-30", summary: "A view", outcomeNotes: "" } })).toThrow(/adoption date/);
  });

  it("round-trips records from every live save action without dropping data", () => {
    let state = workspaceReducer(EMPTY_WORKSPACE, { type: "interview/save", record: record() });
    state = workspaceReducer(state, { type: "draft/save", draft: { id: "d", projectId: "freight", origin: "template-generated", task: "research-plan", title: "Draft", body: "A draft", createdAt: "2026-11-12T00:00:00Z" } });
    state = workspaceReducer(state, { type: "scenario/set", value: { ticker: "KNX", probabilities: { bull: 0.3, base: 0.5, bear: 0.2 }, justification: "Current channel checks support this scenario distribution.", updatedAt: "2026-11-12T00:00:00Z" } });
    state = workspaceReducer(state, { type: "memo/edit", projectId: "freight", sectionId: "executive-summary", text: "My memo edit." });
    state = workspaceReducer(state, { type: "evidence/note", evidenceId: "EV-1", note: "My source note." });
    state = workspaceReducer(state, { type: "thesis/set", value: { projectId: "freight", adoptedOn: "2026-11-12", summary: "A view", outcomeNotes: "" } });
    expect(migrateWorkspace(JSON.parse(serializeWorkspace(state)))).toEqual(state);
  });
});

describe("migrateWorkspace", () => {
  it("drops malformed and provenance-violating records from imports", () => {
    const s = migrateWorkspace({
      version: 0,
      interviews: [record(), { ...record({ id: "i2" }), origin: "ai-generated" }, { id: 3 }, record({ id: "i4", status: "verified" })],
      drafts: [{ origin: "public-secondary", body: "x" }],
      memoEdits: "nope",
    });
    expect(s.version).toBe(1);
    expect(s.interviews.map((r) => r.id)).toEqual(["i1"]);
    expect(s.drafts).toEqual([]);
    expect(s.memoEdits).toEqual({});
  });
  it("returns an empty workspace for garbage", () => {
    expect(migrateWorkspace(null)).toEqual(EMPTY_WORKSPACE);
  });
  it("drops nested values that would crash workspace consumers", () => {
    const state = migrateWorkspace({
      interviews: [record({ interviewDate: undefined as never }), record({ id: "bad-date", createdAt: "garbage" }), record({ id: "bad-status", status: "made-up" as never })],
      drafts: [{ origin: "ai-generated", body: "Missing identifiers and date" }],
      scenarioProbabilities: { KNX: {}, JBHT: { ticker: "JBHT", probabilities: { bull: 0.5 }, justification: "A sufficiently long explanation.", updatedAt: "2026-11-12T00:00:00Z" } },
      memoEdits: { freight: { "executive-summary": { bad: "object" }, "industry-background": "Keep this valid note." }, software: ["bad"] },
      evidenceNotes: { valid: "A note", invalid: { bad: "object" } },
      thesis: { freight: { projectId: "freight", adoptedOn: "not-a-date", summary: "x", outcomeNotes: "" } },
    });
    expect(state.interviews).toEqual([]);
    expect(state.drafts).toEqual([]);
    expect(state.scenarioProbabilities).toEqual({});
    expect(state.memoEdits).toEqual({ freight: { "industry-background": "Keep this valid note." }, software: {} });
    expect(state.evidenceNotes).toEqual({ valid: "A note" });
    expect(state.thesis).toEqual({});
  });
  it("does not accept impossible calendar days or unsafe object keys", () => {
    const state = migrateWorkspace(JSON.parse('{"interviews":[],"memoEdits":{"__proto__":{"polluted":"yes"}},"evidenceNotes":{"constructor":"invalid","valid":"kept"}}'));
    expect(state.memoEdits).toEqual({});
    expect(state.evidenceNotes).toEqual({ valid: "kept" });
    expect(migrateWorkspace({ interviews: [record({ interviewDate: "2026-02-30" })] }).interviews).toEqual([]);
  });
  it("keeps one valid interview and draft for each imported ID", () => {
    const draft = { id: "d", projectId: "freight", origin: "template-generated", task: "research-plan", title: "Draft", body: "First draft", createdAt: "2026-11-12T00:00:00Z" };
    const state = migrateWorkspace({ interviews: [record(), record({ notes: "Duplicate interview" })], drafts: [draft, { ...draft, body: "Duplicate draft" }] });
    expect(state.interviews).toEqual([record()]);
    expect(state.drafts).toEqual([draft]);
    expect(workspaceReducer(EMPTY_WORKSPACE, { type: "import", state })).toEqual(state);
  });
});

describe("workspace import", () => {
  const current: WorkspaceState = {
    ...EMPTY_WORKSPACE,
    interviews: [record()],
    drafts: [{ id: "d1", projectId: "freight", origin: "template-generated", task: "research-plan", title: "Current draft", body: "Local draft", createdAt: "2026-11-12T00:00:00Z" }],
    scenarioProbabilities: { KNX: { ticker: "KNX", probabilities: { bull: 0.3, base: 0.5, bear: 0.2 }, justification: "Local written scenario justification.", updatedAt: "2026-11-12T00:00:00Z" } },
    memoEdits: { freight: { "executive-summary": "Local edited summary" } },
    evidenceNotes: { "EV-1": "Local source note" },
    thesis: { freight: { projectId: "freight", adoptedOn: "2026-11-01", summary: "Local thesis", outcomeNotes: "Still testing" } },
  };

  it("rejects unrelated JSON and future versions before dispatch", () => {
    for (const input of [null, [], {}, { interviews: [] }, { version: 99, interviews: [] }, { version: 1, unrelated: [] }]) {
      expect(() => parseWorkspaceImport(input)).toThrow(WorkspaceValidationError);
    }
  });

  it("preserves all local collections when merging an older partial export", () => {
    const imported = parseWorkspaceImport({ version: 0, interviews: [record({ id: "i2", notes: "An older independent interview." })] });
    const result = workspaceReducer(current, { type: "import", state: imported });
    expect(result.interviews.map((item) => item.id)).toEqual(["i1", "i2"]);
    expect(result.drafts).toEqual(current.drafts);
    expect(result.memoEdits).toEqual(current.memoEdits);
    expect(result.evidenceNotes).toEqual(current.evidenceNotes);
    expect(result.scenarioProbabilities).toEqual(current.scenarioProbabilities);
    expect(result.thesis).toEqual(current.thesis);
  });

  it("keeps browser values on conflicts and adds missing memo sections and notes", () => {
    const imported = parseWorkspaceImport({
      ...current,
      interviews: [record({ notes: "Old imported interview" })],
      drafts: [{ ...current.drafts[0], body: "Old imported draft" }],
      memoEdits: { freight: { "executive-summary": "Old summary", "industry-background": "Imported background" } },
      evidenceNotes: { "EV-1": "Old source note", "EV-2": "New source note" },
      thesis: { freight: { ...current.thesis.freight, summary: "Old imported thesis" } },
    });
    const result = workspaceReducer(current, { type: "import", state: imported });
    expect(result.interviews).toEqual(current.interviews);
    expect(result.drafts).toEqual(current.drafts);
    expect(result.memoEdits.freight).toEqual({ "executive-summary": "Local edited summary", "industry-background": "Imported background" });
    expect(result.evidenceNotes).toEqual({ "EV-1": "Local source note", "EV-2": "New source note" });
    expect(result.thesis).toEqual(current.thesis);
    expect(current.memoEdits.freight).toEqual({ "executive-summary": "Local edited summary" });
  });

  it("round-trips a valid exported workspace and makes repeated imports idempotent", () => {
    const imported = parseWorkspaceImport(JSON.parse(serializeWorkspace(current)));
    expect(imported).toEqual(current);
    expect(workspaceReducer(current, { type: "import", state: imported })).toEqual(current);
  });
});
