import {
  analyzeMotion,
  beginConfirmation,
  beginTracking,
  confirmationRemainingMs,
  distanceMeters,
  shouldTimeoutConfirmation,
  speedFromGps,
} from "../detection";

const at = (timestampMs: number, speedMps: number, accelerationG?: number, rotationMagnitude?: number) => ({
  timestampMs,
  speedMps,
  accelerationG,
  rotationMagnitude,
  locationAccuracyM: 10,
});

describe("Golden Hour deterministic detection", () => {
  test("normal movement enters MOVING", () => {
    const context = { state: "TRACKING" as const, recent: [at(1000, 2)] };
    expect(analyzeMotion(context).nextState).toBe("MOVING");
  });

  test("normal stop does not become an accident", () => {
    const context = {
      state: "MOVING" as const,
      recent: [at(1000, 1.8, 0.4, 0.2), at(2200, 0.2, 0.3, 0.2)],
    };
    expect(analyzeMotion(context).type).not.toBe("abrupt_stop");
  });

  test("GPS distance/time derives movement speed", () => {
    const a = { timestampMs: 0, latitude: 0, longitude: 0, accuracyM: 5 };
    const b = { timestampMs: 1000, latitude: 0, longitude: 0.00002, accuracyM: 5 };
    expect(distanceMeters(a, b)).toBeGreaterThan(1);
    expect(speedFromGps(a, b)).toBeGreaterThan(1);
  });

  test("GPS jitter with poor accuracy is ignored", () => {
    const a = { timestampMs: 0, latitude: 0, longitude: 0, accuracyM: 120 };
    const b = { timestampMs: 1000, latitude: 1, longitude: 1, accuracyM: 120 };
    expect(speedFromGps(a, b)).toBeNull();
  });

  test("single hard acceleration does not escalate", () => {
    const context = {
      state: "TRACKING" as const,
      recent: [at(1000, 2.3, 3.4, 0.2)],
    };
    expect(analyzeMotion(context).nextState).toBe("SUSPICIOUS_MOTION");
  });

  test("sustained suspicious motion followed by corroborated stop confirms", () => {
    const context = {
      state: "SUSPICIOUS_MOTION" as const,
      recent: [
        at(1000, 3, 3.1, 2.9),
        at(1400, 2.8, 2.7, 2.7),
        at(2200, 0.2, 1.5, 1.1),
        at(2500, 0.1, 1.4, 1.2),
      ],
    };
    expect(analyzeMotion(context).type).toBe("abrupt_stop");
  });

  test("unavailable motion does not trigger", () => {
    const context = { state: "TRACKING" as const, recent: [] };
    expect(analyzeMotion(context).type).toBe("none");
  });

  test("confirmation window is exactly 15 seconds conceptually", () => {
    const context = beginConfirmation(10_000);
    expect(context.state).toBe("CONFIRMATION");
    expect(confirmationRemainingMs(10_000, 18_000)).toBe(7000);
    expect(shouldTimeoutConfirmation(10_000, 24_999)).toBe(false);
    expect(shouldTimeoutConfirmation(10_000, 25_000)).toBe(true);
  });

  test("tracking is available in manual and automatic modes", () => {
    expect(beginTracking("manual")).toBe("TRACKING");
    expect(beginTracking("automatic")).toBe("TRACKING");
  });
});
