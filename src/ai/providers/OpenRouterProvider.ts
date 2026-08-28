// OpenRouter cloud provider.
// Optional client-side provider for the runtime abstraction. Prefer Convex
// for production credentials; this path is useful for a direct demo setup.

import type { AIProvider } from "./types";
import type { InferenceRequest, InferenceResult, ProviderType } from "../runtime/types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openrouter/free";

export class OpenRouterProvider implements AIProvider {
  readonly type: ProviderType = "openrouter";
  readonly modelId = DEFAULT_MODEL;

  private readonly apiKey: string;
  private ready = false;

  constructor(apiKey = import.meta.env.VITE_OPENROUTER_API_KEY ?? "") {
    this.apiKey = apiKey.trim();
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) throw new Error("OPENROUTER_API_KEY_MISSING");
    this.ready = true;
  }

  async generate(request: InferenceRequest): Promise<InferenceResult> {
    if (!this.ready) throw new Error("OPENROUTER_PROVIDER_NOT_READY");

    const startedAt = Date.now();
    const messages = [
      ...(request.systemContext
        ? [{ role: "system", content: request.systemContext }]
        : []),
      { role: "user", content: request.prompt },
    ];

    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + this.apiKey,
        "Content-Type": "application/json",
        "HTTP-Referer":
          typeof window !== "undefined"
            ? window.location.origin
            : "https://wellmate-website.vercel.app",
        "X-Title": "WellMate",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages,
        temperature: request.temperature,
        max_tokens: Math.min(request.maxTokens || 512, 768),
      }),
      signal: request.controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        "OPENROUTER_HTTP_" +
          response.status +
          (detail ? ": " + detail.slice(0, 220) : ""),
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("OPENROUTER_EMPTY_RESPONSE");

    request.onToken?.(text);

    return {
      requestId: request.id,
      text,
      tokensGenerated: Math.max(1, Math.ceil(text.length / 4)),
      durationMs: Date.now() - startedAt,
      provider: this.type,
      modelId: this.modelId,
      cached: false,
    };
  }

  async summarize(text: string, maxTokens = 128): Promise<string> {
    const controller = new AbortController();
    const result = await this.generate({
      id: "summary-" + Date.now(),
      prompt: "Summarize this wellness text concisely and factually:\n\n" + text,
      maxTokens,
      temperature: 0.2,
      priority: "low",
      controller,
    });
    return result.text;
  }

  async embed(_text: string): Promise<number[]> {
    return [];
  }

  cancel(_requestId: string): void {}

  async dispose(): Promise<void> {
    this.ready = false;
  }

  isReady(): boolean {
    return this.ready;
  }
}
