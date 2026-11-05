import { NextResponse } from "next/server";
import { getResearchProject } from "@/lib/intel/project";
import { buildWritingSample } from "@/lib/intel/writingSample";

export const revalidate = 3600;

/** Public source data for the downloadable writing sample; no local notes. */
export async function GET(_request: Request, { params: paramsPromise }: { params: Promise<{ projectId: string }> }) {
  const params = await paramsPromise;
  const view = getResearchProject(params.projectId);
  return view ? NextResponse.json(buildWritingSample(view)) : NextResponse.json({ error: "Unknown research project." }, { status: 404 });
}
