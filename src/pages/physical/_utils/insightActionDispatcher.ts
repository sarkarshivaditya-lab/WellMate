// src/pages/physical/_utils/insightActionDispatcher.ts

import type { PhysicalInsight } from "./types";
import type { NavigateFunction } from "react-router-dom";

type DispatchArgs = {
  insight: PhysicalInsight;
  navigate: NavigateFunction;
};

export function dispatchInsightAction(args: DispatchArgs) {
  const { insight, navigate } = args;

  const action = insight.action;
  if (!action) return;

  switch (action.intent) {
    case "log": {
      // Default logging destination
      // Prefer meals as the primary physical logging surface
      navigate("/physical", { replace: false });
      return;
    }

    case "review": {
      // Review insights / data holistically
      navigate("/overview", { replace: false });
      return;
    }

    case "adjust": {
      // Profile or settings adjustments
      navigate("/profile", { replace: false });
      return;
    }

    default: {
      // Exhaustive safety — do nothing
      return;
    }
  }
}
