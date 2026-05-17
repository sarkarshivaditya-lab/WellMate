import { useState, useEffect } from "react";
import {
  getHydrationState,
  subscribeToHydration,
  type HydrationState,
} from "@/reliability/hydration";

/**
 * Reactive bridge for the hydration state machine.
 * Use to gate rendering on hydration readiness or surface
 * degraded / corrupted / failed states to the user.
 */
export function useHydration(): HydrationState {
  const [state, setState] = useState<HydrationState>(getHydrationState);
  useEffect(() => subscribeToHydration(setState), []);
  return state;
}

/** Convenience: returns true when the app data is safe to read from localStorage. */
export function useIsHydrated(): boolean {
  const { status } = useHydration();
  return status === "ready" || status === "degraded";
}
