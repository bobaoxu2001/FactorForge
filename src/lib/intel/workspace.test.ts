import { describe, expect, it } from "vitest";
import { EMPTY_WORKSPACE, migrateWorkspace, workspaceReducer, WorkspaceValidationError, type InterviewRecord } from "./workspace";

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
    const value = { ticker: "KNX", probabilities: { bull: 0.3, base: 0.5, bear: 0.2 }, justification: "", updatedAt: "" };
    expect(() => workspaceReducer(EMPTY_WORKSPACE, { type: "scenario/set", value })).toThrow(/justification/);
    expect(workspaceReducer(EMPTY_WORKSPACE, { type: "scenario/set", value: { ...value, justification: "Bid season channel checks point to flat contract rates." } }).scenarioProbabilities.KNX).toBeDefined();
  });
  it("only accepts AI drafts as ai-generated work product", () => {
    expect(() => workspaceReducer(EMPTY_WORKSPACE, { type: "draft/save", draft: { id: "d", projectId: "freight", origin: "user-primary" as never, task: "x", title: "t", body: "b", createdAt: "" } })).toThrow();
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
});
