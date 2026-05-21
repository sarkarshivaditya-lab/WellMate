// Assistant readiness resolver — single gate for WellMate chat capability.
//
// Evaluates the current AI state and returns whether the assistant can respond,
// and what to show the user if it cannot. Called at the start of every handleSend()
// so that no API calls are attempted when the assistant is not ready.
//
// States:
//   local_ready          — offline AI loaded and in memory, proceed via local
//   cloud_only           — cloud fallback active, local not loaded
//   runtime_initializing — model is activating (genuinely transient)
//   unavailable          — not installed, or terminal failure

import { getRuntimeState } from "@/ai/runtime/runtimeState";
import { getModelLoadState } from "@/ai/providers/local/modelLoader";
import { LAUNCH_STATE } from "@/ai/launchState";
import { getPersistedInstallState } from "@/ai/models/modelLifecycle";

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

  // Terminal failure states — surface explicit messages. Must be checked BEFORE
  // the "warming up" branch so that a failed model is never presented as loading.
  if (rt.modelLoad === "failed_oom") {
    return {
      state: "unavailable",
      canProceed: false,
      guidanceMessage:
        rt.lastError ??
        "Offline AI could not load — not enough memory. Close other apps and restart to try again.",
    };
  }

  if (rt.modelLoad === "failed_degraded") {
    return {
      state: "unavailable",
      canProceed: false,
      guidanceMessage:
        rt.lastError ??
        "Offline AI failed to start on this device. Restart the app to try again.",
    };
  }

  // Non-terminal load failure — autoModelLifecycle will retry in background.
  // Surface the real error so the user understands what happened rather than
  // seeing "warming up" (which implies normal progress).
  if (rt.modelLoad === "failed") {
    return {
      state: "runtime_initializing",
      canProceed: false,
      guidanceMessage:
        rt.lastError ??
        "Offline AI encountered an issue loading. Retrying in the background…",
    };
  }

  // Active download or WASM load in progress — genuinely transient
  if (rt.modelLoad === "loading" || dl.phase === "downloading" || dl.phase === "verifying") {
    return {
      state: "runtime_initializing",
      canProceed: false,
      guidanceMessage:
        "WellMate AI is getting ready — it will be available in just a moment.",
    };
  }

  // Cloud fallback active
  if (LAUNCH_STATE.cloudAssistantAvailable) {
    return { state: "cloud_only", canProceed: true, guidanceMessage: null };
  }

  // Model is installed on device but WASM hasn't loaded this session yet.
  // Only show "warming up" when there is no terminal failure — those are
  // caught above, so reaching this branch means activation is still in flight.
  if (getPersistedInstallState() === "installed") {
    return {
      state: "runtime_initializing",
      canProceed: false,
      guidanceMessage:
        "WellMate AI is warming up — it will be available in just a moment.",
    };
  }

  // No local AI, no cloud
  return {
    state: "unavailable",
    canProceed: false,
    guidanceMessage:
      "Head to the Overview page to download WellMate Offline AI. " +
      "Once that's ready, I'll be here to help with all your wellness questions.",
  };
}
