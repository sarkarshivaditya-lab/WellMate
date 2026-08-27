import {
  analyzeMotion,
  beginConfirmation,
  beginTracking,
  confirmationRemainingMs,
  shouldTimeoutConfirmation,
} from "../detection";
import {
  beginEscalation,
  completeEscalation,
  getDeliveryStatus,
} from "../emergencyService";

describe("Golden Hour detection", () => {
  it("enters tracking for both modes", () => {
    expect(beginTracking("automatic")).toBe("tracking");
    expect(beginTracking("manual")).toBe("tracking");
  });

  it("ignores a normal walking stop", () => {
    const decision = analyzeMotion({
      state: "tracking",
      nowMs: 3000,
      recent: [
        { timestampMs: 1000, speedMps: 1.8, accelerationG: 0.4, rotationMagnitude: 0.4 },
        { timestampMs: 2500, speedMps: 0.2, accelerationG: 0.3, rotationMagnitude: 0.4 },
      ],
    });
    expect(decision.type).toBe("none");
  });

  it("requires multiple signals for an abrupt stop", () => {
    const decision = analyzeMotion({
      state: "tracking",
      nowMs: 3000,
      recent: [
        { timestampMs: 1200, speedMps: 3.2, accelerationG: 3.1, rotationMagnitude: 3.1, locationAccuracyM: 12 },
        { timestampMs: 2000, speedMps: 0.15, accelerationG: 1.4, rotationMagnitude: 1.2, locationAccuracyM: 14 },
      ],
    });
    expect(decision.type).toBe("abrupt_stop");
  });

  it("ignores GPS noise", () => {
    const decision = analyzeMotion({
      state: "tracking",
      nowMs: 3000,
      recent: [
        { timestampMs: 1200, speedMps: 2.8, accelerationG: 2.7, rotationMagnitude: 2.7, locationAccuracyM: 140 },
        { timestampMs: 2200, speedMps: 0.1, accelerationG: 1.5, rotationMagnitude: 1.1, locationAccuracyM: 160 },
      ],
    });
    expect(decision.type).not.toBe("abrupt_stop");
  });

  it("provides a deterministic 15-second confirmation window", () => {
    const confirmation = beginConfirmation(10_000);
    expect(confirmation.state).toBe("confirmation");
    expect(confirmationRemainingMs(10_000, 18_000)).toBe(7_000);
    expect(shouldTimeoutConfirmation(10_000, 25_000)).toBe(false);
    expect(shouldTimeoutConfirmation(10_000, 25_001)).toBe(true);
  });

  it("does not trigger with unavailable motion data", () => {
    const decision = analyzeMotion({
      state: "tracking",
      nowMs: 3000,
      recent: [
        { timestampMs: 1800, speedMps: 0.2 },
        { timestampMs: 2300, speedMps: 0.1 },
      ],
    });
    expect(decision.type).toBe("none");
  });
});


describe("Golden Hour escalation safety", () => {
  it("blocks duplicate escalation while an escalation is in flight", () => {
    expect(beginEscalation()).toBe(true);
    expect(beginEscalation()).toBe(false);
    completeEscalation();
    expect(beginEscalation()).toBe(true);
    completeEscalation();
  });

  it("does not claim delivery without a dispatcher", () => {
    expect(getDeliveryStatus(false)).toBe("PENDING");
    expect(getDeliveryStatus(true, true)).toBe("SUCCESS");
    expect(getDeliveryStatus(true, false)).toBe("FAILED");
    expect(getDeliveryStatus(true)).toBe("PENDING");
  });
});
