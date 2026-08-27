export type TrackingMode = "automatic" | "manual";
export type EmergencyState =
  | "IDLE"
  | "TRACKING"
  | "MOVING"
  | "SUSPICIOUS_MOTION"
  | "CONFIRMATION"
  | "ESCALATING"
  | "ESCALATED"
  | "CANCELLED";

export type MotionSample = {
  timestampMs: number;
  accelerationG?: number;
  rotationMagnitude?: number;
  speedMps?: number;
  locationAccuracyM?: number;
};

export type GpsPoint = {
  timestampMs: number;
  latitude: number;
  longitude: number;
  accuracyM?: number;
};

export type DetectionContext = {
  state: EmergencyState;
  recent: MotionSample[];
  confirmationStartedAtMs?: number;
  suspiciousSinceMs?: number;
};

export type DetectionDecision =
  | { type: "none"; nextState: EmergencyState }
  | { type: "moving"; nextState: "MOVING" }
  | { type: "suspicious_motion"; nextState: "SUSPICIOUS_MOTION" }
  | { type: "abrupt_stop"; nextState: "CONFIRMATION" };

const MOTION_WINDOW_MS = 3000;
const SUSPICIOUS_WINDOW_MS = 1200;
const CONFIRMATION_WINDOW_MS = 15_000;
const MIN_SUSPICIOUS_ACCEL_G = 2.2;
const MIN_SUSPICIOUS_ROTATION = 2.5;
const MIN_MOVING_SPEED_MPS = 1.2;
const STOP_SPEED_MPS = 0.35;
const MIN_LOCATION_ACCURACY_M = 80;

export function distanceMeters(a: GpsPoint, b: GpsPoint): number {
  const earthRadiusM = 6_371_000;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusM * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function speedFromGps(previous: GpsPoint, current: GpsPoint): number | null {
  const dtSeconds = (current.timestampMs - previous.timestampMs) / 1000;
  if (dtSeconds <= 0) return null;
  if ((previous.accuracyM ?? 0) > MIN_LOCATION_ACCURACY_M) return null;
  if ((current.accuracyM ?? 0) > MIN_LOCATION_ACCURACY_M) return null;
  return distanceMeters(previous, current) / dtSeconds;
}

function recentSamples(samples: MotionSample[], nowMs: number): MotionSample[] {
  return samples.filter((sample) => nowMs - sample.timestampMs <= MOTION_WINDOW_MS);
}

export function analyzeMotion(context: DetectionContext): DetectionDecision {
  const samples = recentSamples(context.recent, Date.now());
  if (context.state === "IDLE" || context.state === "CANCELLED") {
    return { type: "none", nextState: "IDLE" };
  }
  if (samples.length === 0) {
    return { type: "none", nextState: context.state };
  }

  const usable = samples.filter(
    (sample) => (sample.locationAccuracyM ?? 0) <= MIN_LOCATION_ACCURACY_M || sample.locationAccuracyM === undefined,
  );

  const meaningfulMovement = usable.some((sample) => (sample.speedMps ?? 0) >= MIN_MOVING_SPEED_MPS);
  if (meaningfulMovement && context.state === "TRACKING") {
    return { type: "moving", nextState: "MOVING" };
  }

  const suspicious = usable.some(
    (sample) =>
      (sample.accelerationG ?? 0) >= MIN_SUSPICIOUS_ACCEL_G ||
      (sample.rotationMagnitude ?? 0) >= MIN_SUSPICIOUS_ROTATION,
  );

  const movingBeforeStop = usable.some((sample) => (sample.speedMps ?? 0) >= MIN_MOVING_SPEED_MPS);
  const stoppedAfterMovement = usable.some((sample) => (sample.speedMps ?? Infinity) <= STOP_SPEED_MPS);
  const corroboratedImpact = usable.filter(
    (sample) =>
      (sample.accelerationG ?? 0) >= 1.2 ||
      (sample.rotationMagnitude ?? 0) >= 1,
  ).length >= 2;

  if (suspicious && context.state !== "SUSPICIOUS_MOTION") {
    return { type: "suspicious_motion", nextState: "SUSPICIOUS_MOTION" };
  }

  if (
    context.state === "SUSPICIOUS_MOTION" &&
    suspicious &&
    movingBeforeStop &&
    stoppedAfterMovement &&
    corroboratedImpact
  ) {
    return { type: "abrupt_stop", nextState: "CONFIRMATION" };
  }

  if (context.state === "MOVING" && suspicious) {
    return { type: "suspicious_motion", nextState: "SUSPICIOUS_MOTION" };
  }

  return { type: "none", nextState: context.state };
}

export function beginTracking(mode: TrackingMode): EmergencyState {
  return mode === "automatic" || mode === "manual" ? "TRACKING" : "IDLE";
}

export function stopTracking(): EmergencyState {
  return "IDLE";
}

export function cancelEmergency(): EmergencyState {
  return "CANCELLED";
}

export function beginConfirmation(startedAtMs: number): DetectionContext {
  return {
    state: "CONFIRMATION",
    recent: [],
    confirmationStartedAtMs: startedAtMs,
  };
}

export function confirmationRemainingMs(startedAtMs: number, nowMs: number): number {
  return Math.max(0, CONFIRMATION_WINDOW_MS - Math.max(0, nowMs - startedAtMs));
}

export function shouldTimeoutConfirmation(startedAtMs: number, nowMs: number): boolean {
  return confirmationRemainingMs(startedAtMs, nowMs) === 0;
}
