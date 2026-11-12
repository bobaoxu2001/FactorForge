"use client";

import { useSyncExternalStore } from "react";
import { createWorkspaceStore, SERVER_WORKSPACE_SNAPSHOT } from "@/lib/intel/workspaceStore";
import type { WorkspaceAction } from "@/lib/intel/workspace";

let clientStore: ReturnType<typeof createWorkspaceStore> | undefined;
const store = () => clientStore ??= createWorkspaceStore(() => window.localStorage, window);
const subscribe = (listener: () => void) => store().subscribe(listener);
const getSnapshot = () => store().getSnapshot();
const getServerSnapshot = () => SERVER_WORKSPACE_SNAPSHOT;
const dispatch = (action: WorkspaceAction) => store().dispatch(action);

/** Private state shared across research panels; storage failures retain memory. */
export function useWorkspace() {
  return { ...useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot), dispatch };
}
