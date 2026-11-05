import { NextResponse } from "next/server";
import { callDeepseekJson, isDeepseekConfigured } from "@/lib/ai/deepseek";
import {
  boostIdsFor,
  buildModelPayload,
  COPILOT_SYSTEM_PROMPT,
  COPILOT_TASKS,
  deterministicAnswer,
  MAX_QUESTION_CHARS,
  MAX_TEXT_CHARS,
  requestScreen,
  retrieve,
  validateModelOutput,
  type CopilotRequest,
  type CopilotResponse,
  type CopilotTask,
} from "@/lib/intel/copilot";
import { getResearchProject } from "@/lib/intel/project";
import { createLogger } from "@/lib/observability/logger";
import { checkRateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const log = createLogger("copilot");
const TASK_IDS = new Set<string>(COPILOT_TASKS.map((t) => t.id));
const HOUR_MS = 60 * 60 * 1000;

function limitPerHour(): number {
  const raw = Number(process.env.COPILOT_RATE_LIMIT_PER_HOUR);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 30;
}

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

function parseRequest(body: unknown): CopilotRequest | string {
  if (!body || typeof body !== "object") return "Body must be a JSON object.";
  const b = body as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const task = str(b.task);
  if (!task || !TASK_IDS.has(task)) return "Unknown task.";
  const projectId = str(b.projectId);
  if (!projectId) return "projectId is required.";
  const question = str(b.question);
  const text = str(b.text);
  if (question && question.length > MAX_QUESTION_CHARS) return `Question exceeds ${MAX_QUESTION_CHARS} characters.`;
  if (text && text.length > MAX_TEXT_CHARS) return `Text exceeds ${MAX_TEXT_CHARS} characters.`;
  return {
    projectId,
    task: task as CopilotTask,
    question,
    text,
    hypothesisId: str(b.hypothesisId),
    ticker: str(b.ticker),
    stakeholderId: str(b.stakeholderId),
    allowAi: b.allowAi === true,
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const req = parseRequest(body);
  if (typeof req === "string") return NextResponse.json({ error: req }, { status: 400 });

  const view = getResearchProject(req.projectId);
  if (!view) return NextResponse.json({ error: "Unknown project." }, { status: 404 });

  const limit = await checkRateLimit(`copilot:ip:${clientIp(request)}`, limitPerHour(), HOUR_MS);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Rate limit reached for the research copilot. Try again later." }, { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } });
  }

  const query = [req.question, req.text?.slice(0, 2_000), req.ticker, req.hypothesisId, req.task.replace(/-/g, " ")].filter(Boolean).join(" ");
  const retrieved = retrieve(view.evidence, query, 14, boostIdsFor(view, req));
  const screen = requestScreen(req);
  const deterministic = deterministicAnswer(view, req);
  const retrievedSummary = retrieved.map((e) => ({ id: e.id, claim: e.claim, publisher: e.source.publisher, status: e.status, origin: e.origin }));

  const base: Omit<CopilotResponse, "source" | "facts" | "calculations" | "interpretation" | "hypotheses" | "missing" | "followUps" | "unsupported"> = {
    task: req.task,
    retrieved: retrievedSummary,
    warnings: [...new Set([...screen.warnings, ...deterministic.warnings])],
    origin: "ai-generated",
  };

  // Notes containing possible MNPI, or text without explicit opt-in, never reach the model.
  const textTask = req.task === "notes-analysis" || req.task === "kpi-extract";
  // Reproducible screen directions and arithmetic come from the research engine.
  const templateTask = req.task === "interview-guide" || req.task === "evidence-check" || req.task === "hypotheses";
  const useModel = isDeepseekConfigured() && retrieved.length > 0 && !(textTask && screen.blockAi) && !templateTask;
  if (useModel) {
    const raw = await callDeepseekJson<unknown>({
      messages: [
        { role: "system", content: COPILOT_SYSTEM_PROMPT },
        { role: "user", content: buildModelPayload(view, { ...req, allowAi: req.allowAi && !screen.blockAi }, retrieved) },
      ],
      temperature: 0.2,
      maxTokens: 1_100,
      timeoutMs: 20_000,
    });
    if (raw) {
      const validated = validateModelOutput(raw, retrieved.map((e) => e.id));
      if (validated.unsupported.length > 0) log.info("copilot dropped uncited statements", { task: req.task, dropped: validated.unsupported.length });
      const response: CopilotResponse = { ...base, source: "deepseek", ...validated };
      return NextResponse.json(response);
    }
    base.warnings.push("The AI model did not return a usable answer; showing the deterministic analysis instead.");
  }

  const response: CopilotResponse = {
    ...base,
    source: "deterministic",
    origin: "template-generated",
    facts: deterministic.facts,
    calculations: deterministic.calculations,
    interpretation: deterministic.interpretation,
    hypotheses: deterministic.hypotheses,
    missing: deterministic.missing,
    followUps: deterministic.followUps,
    unsupported: [],
    retrieved: [...new Map([...retrieved, ...view.evidence.filter((e) => [...deterministic.facts, ...deterministic.calculations].some((s) => s.evidenceIds.includes(e.id)))].map((e) => [e.id, { id: e.id, claim: e.claim, publisher: e.source.publisher, status: e.status, origin: e.origin }])).values()],
  };
  return NextResponse.json(response);
}
