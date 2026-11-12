import { afterEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceStore, SERVER_WORKSPACE_SNAPSHOT } from "./workspaceStore";
import { EMPTY_WORKSPACE, WORKSPACE_STORAGE_KEY } from "./workspace";

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

const edit = (sectionId: string, text = sectionId) => ({ type: "memo/edit" as const, projectId: "freight", sectionId, text });

describe("browser workspace store", () => {
  it("returns validation errors synchronously and leaves the existing state intact", () => {
    const store = createWorkspaceStore(() => localStorage, window);
    store.dispatch(edit("existing"));
    const before = store.getSnapshot();
    const error = store.dispatch({ type: "scenario/set", value: { ticker: "KNX", probabilities: { bull: 0.3, base: 0.5, bear: 0.2 }, justification: "", updatedAt: "2026-11-12T00:00:00Z" } });
    expect(error).toMatch(/justification/);
    expect(store.getSnapshot()).toBe(before);
    expect(JSON.parse(localStorage.getItem(WORKSPACE_STORAGE_KEY)!)).toMatchObject({ memoEdits: { freight: { existing: "existing" } } });
  });

  it("notifies every panel and preserves rapid consecutive edits", () => {
    const store = createWorkspaceStore(() => localStorage, window);
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = store.subscribe(first);
    const stopSecond = store.subscribe(second);
    store.dispatch(edit("a"));
    store.dispatch(edit("b"));
    expect(store.getSnapshot().state.memoEdits.freight).toEqual({ a: "a", b: "b" });
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(2);
    stopFirst(); stopSecond();
  });

  it("retains unsaved state across subscribers and retries persistence on the next save", () => {
    const store = createWorkspaceStore(() => localStorage, window);
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Quota exceeded", "QuotaExceededError"); });
    const stop = store.subscribe(vi.fn());
    expect(store.dispatch(edit("unsaved"))).toBeNull();
    expect(store.getSnapshot().persisted).toBe(false);
    stop();
    const stopNext = store.subscribe(vi.fn());
    window.dispatchEvent(new StorageEvent("storage", { key: WORKSPACE_STORAGE_KEY, newValue: null }));
    expect(store.getSnapshot().state.memoEdits.freight.unsaved).toBe("unsaved");
    set.mockRestore();
    store.dispatch(edit("next"));
    expect(store.getSnapshot().persisted).toBe(true);
    expect(JSON.parse(localStorage.getItem(WORKSPACE_STORAGE_KEY)!).memoEdits.freight).toEqual({ unsaved: "unsaved", next: "next" });
    stopNext();
  });

  it("reads a preceding other-tab edit before saving, and ignores unrelated storage events", () => {
    const store = createWorkspaceStore(() => localStorage, window);
    const update = vi.fn();
    const stop = store.subscribe(update);
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({ ...EMPTY_WORKSPACE, evidenceNotes: { "EV-1": "Other tab" } }));
    window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" }));
    expect(update).not.toHaveBeenCalled();
    store.dispatch(edit("local"));
    expect(store.getSnapshot().state.evidenceNotes).toEqual({ "EV-1": "Other tab" });
    stop();
  });

  it("synchronizes this workspace's storage events and clears", () => {
    const store = createWorkspaceStore(() => localStorage, window);
    const stop = store.subscribe(vi.fn());
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({ ...EMPTY_WORKSPACE, evidenceNotes: { "EV-1": "Changed" } }));
    window.dispatchEvent(new StorageEvent("storage", { key: WORKSPACE_STORAGE_KEY }));
    expect(store.getSnapshot().state.evidenceNotes["EV-1"]).toBe("Changed");
    localStorage.clear();
    window.dispatchEvent(new StorageEvent("storage", { key: null }));
    expect(store.getSnapshot().state).toEqual(EMPTY_WORKSPACE);
    stop();
  });

  it("notifies panels of an external change even when the following save is invalid", () => {
    const store = createWorkspaceStore(() => localStorage, window);
    const update = vi.fn();
    const stop = store.subscribe(update);
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({ ...EMPTY_WORKSPACE, evidenceNotes: { "EV-1": "Other tab" } }));
    const error = store.dispatch({ type: "scenario/set", value: { ticker: "KNX", probabilities: { bull: 0.3, base: 0.5, bear: 0.2 }, justification: "", updatedAt: "2026-11-12T00:00:00Z" } });
    expect(error).toMatch(/justification/);
    expect(store.getSnapshot().state.evidenceNotes["EV-1"]).toBe("Other tab");
    expect(update).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new StorageEvent("storage", { key: WORKSPACE_STORAGE_KEY }));
    expect(update).toHaveBeenCalledTimes(1);
    stop();
  });

  it("keeps blocked storage in memory and keeps private state out of the server snapshot", () => {
    const store = createWorkspaceStore(() => { throw new DOMException("Blocked", "SecurityError"); }, window);
    expect(store.getSnapshot().persisted).toBe(false);
    expect(store.dispatch(edit("private"))).toBeNull();
    expect(store.getSnapshot().state.memoEdits.freight.private).toBe("private");
    expect(SERVER_WORKSPACE_SNAPSHOT).toEqual({ state: EMPTY_WORKSPACE, ready: false, persisted: true });
  });
});
