// Assistant readiness resolver — single gate for WellMate chat capability.
//
// Evaluates the current AI state and returns whether the assistant can respond,
// and what to show the user if it cannot. This is called at the start of every
// handleSend() so that no API calls are attempted when the assistant is not ready.
//
// States:
//   local_ready          — offline AI loaded and in memory, proceed via local
//   cloud_only           — cloud fallback active, local not loaded
//   runtime_initializing — model download or activation in progress
//   unavailable          — neither local AI nor cloud are active
//
// Guidance messages are written in WellMate tone: calm, supportive, non-technical.
// They surface as normal assistant chat bubbles, not error states.

import { getRuntimeState } from "@/ai/runtime/runtimeState";
import { getModelLoadState } from "@/ai/providers/local/modelLoader";
import { LAUNCH_STATE } from "@/ai/launchState";

export type AssistantReadinessState =
  | "local_ready"
  | "cloud_only"
  | "runtime_initializing"
  | "unavailable";

export type AssistantReadinessResult = {
  state: AssistantReadinessState;
  canProceed: boolean;
  // Non-null when canProceed is false — shown directly as an assistant message.
  guidanceMessage: string | null;
};

export function resolveAssistantReadiness(): AssistantReadinessResult {
  const rt = getRuntimeState();
  const dl = getModelLoadState();

  // Local AI fully loaded and ready
  if (rt.modelLoad === "ready") {
    return { state: "local_ready", canProceed: true, guidanceMessage: null };
  }

  // Local AI currently activating or downloading — transient state
  if (rt.modelLoad === "loading" || dl.phase === "downloading" || dl.phase === "verifying") {
    return {
      state: "runtime_initializing",
      canProceed: false,
      guidanceMessage:
        "WellMate AI is getting ready — it will be available in just a moment.",
    };
  }

  // Cloud fallback active — local not loaded but cloud is configured
  if (LAUNCH_STATE.cloudAssistantAvailable) {
    return { state: "cloud_only", canProceed: true, guidanceMessage: null };
  }

  // Neither local AI nor cloud is available
  return {
    state: "unavailable",
    canProceed: false,
    guidanceMessage:
      "Head to the Overview page to download WellMate Offline AI. " +
      "Once that's ready, I'll be here to help with all your wellness questions.",
  };
}
