import "server-only";

const DEEPSEEK_CHAT_URL = "https://api.deepseek.com/v1/chat/completions";

export interface DeepseekMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DeepseekJsonRequest {
  messages: DeepseekMessage[];
  model?: "deepseek-chat" | "deepseek-reasoner";
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export function isDeepseekConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

export async function callDeepseekJson<T>(request: DeepseekJsonRequest): Promise<T | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeoutMs = request.timeoutMs ?? 12_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(DEEPSEEK_CHAT_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: request.model ?? "deepseek-chat",
        messages: request.messages,
        temperature: request.temperature ?? 0.4,
        max_tokens: request.maxTokens ?? 700,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
