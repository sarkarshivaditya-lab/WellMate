export type AIRequest = {
  prompt: string;
  conversationId?: string;
  context?: Record<string, unknown>;
};

export type AIResponse = {
  text: string;
  provider: "online";
  model?: string;
};

export interface OnlineAIAdapter {
  generate(request: AIRequest): Promise<AIResponse>;
  summarize(text: string): Promise<AIResponse>;
}

export class UnconfiguredOnlineAIAdapter implements OnlineAIAdapter {
  public async generate(): Promise<AIResponse> {
    throw new Error("Online AI provider is not configured");
  }

  public async summarize(): Promise<AIResponse> {
    throw new Error("Online AI provider is not configured");
  }
}

let adapter: OnlineAIAdapter = new UnconfiguredOnlineAIAdapter();

export function configureOnlineAI(nextAdapter: OnlineAIAdapter): void {
  adapter = nextAdapter;
}

export function getOnlineAIAdapter(): OnlineAIAdapter {
  return adapter;
}
