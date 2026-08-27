// Deterministic Golden Hour accident-detection core.
// Pure state transitions are intentionally separated from device APIs so they
// remain unit-testable and platform adapters can feed normalized signals.

export type TrackingMode = "automatic" | "manual";
export type EmergencyState =
  | "idle"
  | "tracking"
  | "suspicious_motion"
  | "confirmation"
  | "escalating"
  | "escalated"
  | "cancelled";

export type MotionSample = {
  timestampMs: number;
  speedMps?: number;
  accelerationG?: number;
  rotationMagnitude?: number;
  locationAccuracyM?: number;
};

export type DetectionContext = {
  recent: MotionSample[];
  nowMs: number;
  state: EmergencyState;
  confirmationStartedAtMs?: number;
};

export type DetectionDecision =
  | { type: "none" }
  | { type: "suspicious_motion" }
  | { type: "abrupt_stop" };

const MOTION_WINDOW_MS = 2500;
const CONFIRMATION_WINDOW_MS = 15_000;
const MIN_SUSPICIOUS_ACCEL_G = 2.2;
const MIN_SUSPICIOUS_ROTATION = 2.5;
const SUDDEN_STOP_SPEED_MPS = 1.5;
const STOP_SPEED_MPS = 0.35;
const MIN_SUSPICIOUS_SAMPLES = 2;

function recentWindow(samples: MotionSample[], nowMs: number): MotionSample[] {
  return samples.filter((sample) => nowMs - sample.timestampMs <= MOTION_WINDOW_MS);
}

export function analyzeMotion(context: DetectionContext): DetectionDecision {
  const samples = recentWindow(context.recent, context.nowMs);
  if (samples.length < MIN_SUSPICIOUS_SAMPLES) return { type: "none" };

  const noisyLocation = samples.some(
    (sample) =>
      sample.locationAccuracyM !== undefined &&
      sample.locationAccuracyM > 80,
  );

  const meaningfulMotion = samples.some(
    (sample) =>
      (sample.accelerationG ?? 0) >= MIN_SUSPICIOUS_ACCEL_G ||
      (sample.rotationMagnitude ?? 0) >= MIN_SUSPICIOUS_ROTATION,
  );

  const hasMovementBeforeImpact = samples.some(
    (sample) => (sample.speedMps ?? 0) > SUDDEN_STOP_SPEED_MPS,
  );

  const hasAbruptStop = hasMovementBeforeImpact
    && samples.some(
      (sample) =>
        (sample.speedMps ?? Number.POSITIVE_INFINITY) <= STOP_SPEED_MPS &&
        ((sample.accelerationG ?? 0) >= 1.2 || (sample.rotationMagnitude ?? 0) >= 1),
    );

  if (hasAbruptStop && !noisyLocation && meaningfulMotion) {
    return { type: "abrupt_stop" };
  }

  if (meaningfulMotion && hasMovementBeforeImpact) {
    return { type: "suspicious_motion" };
  }

  return { type: "none" };
}

export function beginTracking(mode: TrackingMode): EmergencyState {
  return mode === "manual" || mode === "automatic" ? "tracking" : "idle";
}

export function beginConfirmation(startedAtMs: number): DetectionContext {
  return {
    recent: [],
    nowMs: startedAtMs,
    state: "confirmation",
    confirmationStartedAtMs: startedAtMs,
  };
}

export function confirmationRemainingMs(
  startedAtMs: number,
  nowMs: number,
): number {
  return Math.max(0, CONFIRMATION_WINDOW_MS - Math.max(0, nowMs - startedAtMs));
}

export function shouldTimeoutConfirmation(
  startedAtMs: number,
  nowMs: number,
): boolean {
  return confirmationRemainingMs(startedAtMs, nowMs) === 0;
}
