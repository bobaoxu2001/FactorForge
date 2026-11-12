import { EMPTY_WORKSPACE, migrateWorkspace, WORKSPACE_STORAGE_KEY, workspaceReducer, type WorkspaceAction, type WorkspaceState } from "./workspace";

export interface WorkspaceSnapshot {
  state: WorkspaceState;
  ready: boolean;
  persisted: boolean;
}

/** Stable server snapshot: private browser data is never read during SSR. */
export const SERVER_WORKSPACE_SNAPSHOT: WorkspaceSnapshot = { state: EMPTY_WORKSPACE, ready: false, persisted: true };

/**
 * One synchronous store per browser document. All mounted consumers share
 * the same memory state, including when localStorage is unavailable or full.
 * Reducer validation finishes before dispatch returns, so forms can retain
 * invalid input and show the actual error instead of claiming it was saved.
 */
export function createWorkspaceStore(getStorage: () => Storage, events: Pick<Window, "addEventListener" | "removeEventListener">) {
  let snapshot: WorkspaceSnapshot = { state: EMPTY_WORKSPACE, ready: true, persisted: true };
  let storedRaw: string | null | undefined;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  function refresh() {
    try {
      const raw = getStorage().getItem(WORKSPACE_STORAGE_KEY);
      if (raw !== storedRaw) {
        const state = raw === null ? { ...EMPTY_WORKSPACE } : migrateWorkspace(JSON.parse(raw));
        storedRaw = raw;
        snapshot = { state, ready: true, persisted: true };
      }
    } catch {
      if (snapshot.persisted) snapshot = { ...snapshot, persisted: false };
    }
  }

  function onStorage(event: StorageEvent) {
    if (event.key !== null && event.key !== WORKSPACE_STORAGE_KEY) return;
    try {
      if (event.storageArea && event.storageArea !== getStorage()) return;
    } catch { return; }
    // Another tab must not erase edits that could not be persisted locally.
    if (!snapshot.persisted) return;
    const previous = snapshot;
    refresh();
    if (snapshot !== previous) notify();
  }

  refresh();

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      if (listeners.size === 0) {
        if (snapshot.persisted) refresh();
        events.addEventListener("storage", onStorage as EventListener);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) events.removeEventListener("storage", onStorage as EventListener);
      };
    },
    dispatch(action: WorkspaceAction): string | null {
      // Include a preceding write from another tab even if its storage event
      // has not been delivered yet. Unsaved in-memory edits take precedence.
      const previous = snapshot;
      if (snapshot.persisted) refresh();
      let next: WorkspaceState;
      try {
        next = workspaceReducer(snapshot.state, action);
      } catch (error) {
        if (snapshot !== previous) notify();
        return error instanceof Error ? error.message : String(error);
      }
      let persisted = true;
      try {
        const raw = JSON.stringify(next);
        getStorage().setItem(WORKSPACE_STORAGE_KEY, raw);
        storedRaw = raw;
      } catch { persisted = false; }
      snapshot = { state: next, ready: true, persisted };
      notify();
      return null;
    },
  };
}
