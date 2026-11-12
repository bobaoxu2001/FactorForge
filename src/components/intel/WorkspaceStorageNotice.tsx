"use client";

import Link from "next/link";
import { useWorkspace } from "./useWorkspace";

export default function WorkspaceStorageNotice({ projectId }: { projectId: string }) {
  const { ready, persisted } = useWorkspace();
  if (!ready || persisted !== false) return null;
  return (
    <div role="status" className="rounded-md border border-amber-600/30 bg-amber-100/40 px-4 py-3 text-[12.5px] leading-relaxed text-amber-900 print:hidden">
      Browser storage is unavailable. Changes stay in memory for this tab and may be lost when you close or reload it.{" "}
      <Link href={`/research/${projectId}/primary`} className="font-medium underline underline-offset-2">Export a workspace backup</Link> before leaving.
    </div>
  );
}
