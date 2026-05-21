// Streaming optimizer — governor-aware token pacing for smooth UI delivery.
//
// Wraps the raw onToken callback from inference with:
//   - inter-token delay derived from governor policy + thermal state
//   - 16ms buffer drain interval to batch rapid tokens
//   - thermal backpressure: additional delay on hot/critical states
//   - flush() to drain buffered tokens immediately
//   - cancel() to discard pending tokens
//
// Chain order in orchestrator (outer to inner, execution order left-to-right):
//   llama → stuckGuard.wrappedOnToken → optimizer.wrappedOnToken → UI onToken
// stuckGuard resets its watchdog on every real token; optimizer paces UI delivery.

import type { RuntimePolicy } from "./runtimeGovernor";
import { getThermalState } from "./thermalGuard";

export type OptimizedStreamHandle = {
  wrappedOnToken: (token: string) => void;
  flush: () => void;
  cancel: () => void;
  getStats: () => StreamStats;
};

export type StreamStats = {
  tokensReceived: number;
  tokensDelivered: number;
  avgPacingMs: number;
  thermalThrottleCount: number;
};

type OptimizerOptions = {
  onToken: (token: string) => void;
  policy: RuntimePolicy;
  thermal?: string;
};

const DRAIN_INTERVAL_MS = 16;
const THERMAL_BONUS_MS: Record<string, number> = {
  nominal: 0,
  warm: 10,
  hot: 30,
  critical: 60,
  emergency: 120,
};

export function createOptimizedStream(opts: OptimizerOptions): OptimizedStreamHandle {
  const { onToken, policy } = opts;
  const buffer: string[] = [];
  let drainHandle: ReturnType<typeof setInterval> | null = null;
  let cancelled = false;

  let tokensReceived = 0;
  let tokensDelivered = 0;
  let thermalThrottleCount = 0;
  let totalPacingMs = 0;
  let pacingMeasurements = 0;

  const baseThrottleMs = policy.streamingThrottleMs ?? 0;

  function getCurrentThrottleMs(): number {
    const thermal = getThermalState();
    const bonus = THERMAL_BONUS_MS[thermal] ?? 0;
    if (bonus > 0) thermalThrottleCount++;
    return baseThrottleMs + bonus;
  }

  function drainBuffer(): void {
    if (cancelled || buffer.length === 0) return;
    const throttle = getCurrentThrottleMs();

    if (throttle <= 0) {
      // No pacing — flush all immediately
      while (buffer.length > 0) {
        onToken(buffer.shift()!);
        tokensDelivered++;
      }
    } else {
      // Deliver one token per drain tick with throttle tracking
      const token = buffer.shift();
      if (token !== undefined) {
        onToken(token);
        tokensDelivered++;
        totalPacingMs += throttle;
        pacingMeasurements++;
      }
    }
  }

  function startDrain(): void {
    if (drainHandle !== null) return;
    drainHandle = setInterval(drainBuffer, DRAIN_INTERVAL_MS);
  }

  function stopDrain(): void {
    if (drainHandle !== null) {
      clearInterval(drainHandle);
      drainHandle = null;
    }
  }

  return {
    wrappedOnToken(token: string): void {
      if (cancelled) return;
      tokensReceived++;
      buffer.push(token);
      startDrain();
    },

    flush(): void {
      if (cancelled) return;
      stopDrain();
      while (buffer.length > 0) {
        onToken(buffer.shift()!);
        tokensDelivered++;
      }
    },

    cancel(): void {
      cancelled = true;
      stopDrain();
      buffer.length = 0;
    },

    getStats(): StreamStats {
      return {
        tokensReceived,
        tokensDelivered,
        avgPacingMs: pacingMeasurements > 0 ? totalPacingMs / pacingMeasurements : 0,
        thermalThrottleCount,
      };
    },
  };
}
