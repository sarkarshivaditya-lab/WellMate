export type AssistantReadinessState = "online_ready" | "unconfigured";

export type AssistantReadinessResult = {
  state: AssistantReadinessState;
  canProceed: boolean;
  guidanceMessage: string | null;
};

export function resolveAssistantReadiness(configured = false): AssistantReadinessResult {
  if (configured) {
    return {
      state: "online_ready",
      canProceed: true,
      guidanceMessage: null,
    };
  }

  return {
    state: "unconfigured",
    canProceed: false,
    guidanceMessage: "Online AI is not configured yet.",
  };
}
