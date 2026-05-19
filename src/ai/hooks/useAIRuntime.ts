import React from "react";
import type { AIRuntimeState } from "../runtime/types";
import {
  getRuntimeState,
  subscribeToRuntimeState,
} from "../runtime/runtimeState";

export function useAIRuntime(): AIRuntimeState {
  const [state, setState] = React.useState<AIRuntimeState>(getRuntimeState);

  React.useEffect(() => {
    return subscribeToRuntimeState(setState);
  }, []);

  return state;
}
