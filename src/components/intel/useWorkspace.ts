"use client";

import { useCallback, useEffect, useState } from "react";
import { EMPTY_WORKSPACE, migrateWorkspace, WORKSPACE_STORAGE_KEY, workspaceReducer, type WorkspaceAction, type WorkspaceState } from "@/lib/intel/workspace";

const EVENT = "factorforge:workspace";

function read(): WorkspaceState {
  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    return raw ? migrateWorkspace(JSON.parse(raw)) : { ...EMPTY_WORKSPACE };
  } catch {
    return { ...EMPTY_WORKSPACE };
  }
}

/**
 * The user's private research workspace, persisted in this browser only.
 * Every write goes through the validated reducer; storage failures (private
 * mode, quota) degrade to in-memory state instead of breaking the page.
 */
export function useWorkspace() {
  const [state, setState] = useState<WorkspaceState>(EMPTY_WORKSPACE);
  const [ready, setReady] = useState(false);
  const [persisted, setPersisted] = useState(true);

  useEffect(() => {
    setState(read());
    setReady(true);
    const sync = () => setState(read());
    window.addEventListener("storage", sync);
    window.addEventListener(EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(EVENT, sync);
    };
  }, []);

  const dispatch = useCallback((action: WorkspaceAction): string | null => {
    let error: string | null = null;
    setState((current) => {
      try {
        const next = workspaceReducer(current, action);
        try {
          window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(next));
          setPersisted(true);
          queueMicrotask(() => window.dispatchEvent(new Event(EVENT)));
        } catch {
          setPersisted(false);
        }
        return next;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        return current;
      }
    });
    return error;
  }, []);

  return { state, ready, persisted, dispatch };
}
