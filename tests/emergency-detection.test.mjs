import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeMotion,
  beginConfirmation,
  beginTracking,
  cancelEmergency,
  confirmationRemainingMs,
  distanceMeters,
  shouldTimeoutConfirmation,
  speedFromGps,
} from "../src/emergency/detection.ts";

const now = Date.now();
const at = (offsetMs, speedMps, accelerationG, rotationMagnitude) => ({
  timestampMs: now + offsetMs,
  speedMps,
  accelerationG,
  rotationMagnitude,
  locationAccuracyM: 10,
});

test("normal movement enters MOVING", () => {
  assert.equal(analyzeMotion({ state: "TRACKING", recent: [at(-500, 2)] }, now).nextState, "MOVING");
});

test("normal stop does not become an accident", () => {
  const context = { state: "MOVING", recent: [at(-1200, 1.8, 0.4, 0.2), at(-100, 0.2, 0.3, 0.2)] };
  assert.notEqual(analyzeMotion(context, now).type, "abrupt_stop");
});

test("GPS distance/time derives movement speed", () => {
  const a = { timestampMs: now - 1000, latitude: 0, longitude: 0, accuracyM: 5 };
  const b = { timestampMs: now, latitude: 0, longitude: 0.00002, accuracyM: 5 };
  assert.ok(distanceMeters(a, b) > 1);
  assert.ok(speedFromGps(a, b) > 1);
});

test("GPS jitter with poor accuracy is ignored", () => {
  const a = { timestampMs: now - 1000, latitude: 0, longitude: 0, accuracyM: 120 };
  const b = { timestampMs: now, latitude: 1, longitude: 1, accuracyM: 120 };
  assert.equal(speedFromGps(a, b), null);
});

test("single hard acceleration does not escalate", () => {
  assert.equal(analyzeMotion({ state: "TRACKING", recent: [at(-300, 0.2, 3.4, 0.2)] }, now).nextState, "SUSPICIOUS_MOTION");
});

test("sustained suspicious motion followed by corroborated stop confirms", () => {
  const context = {
    state: "SUSPICIOUS_MOTION",
    suspiciousSinceMs: now - 2000,
    recent: [at(-1000, 3, 3.1, 2.9), at(-700, 2.8, 2.7, 2.7), at(-300, 0.2, 1.5, 1.1), at(-100, 0.1, 1.4, 1.2)],
  };
  assert.equal(analyzeMotion(context, now).type, "abrupt_stop");
});

test("rotation alone becomes suspicious but not confirmation", () => {
  const context = { state: "TRACKING", recent: [at(-300, 0.2, 0.5, 3)] };
  assert.equal(analyzeMotion(context, now).nextState, "SUSPICIOUS_MOTION");
});

test("unavailable motion does not trigger", () => {
  assert.equal(analyzeMotion({ state: "TRACKING", recent: [] }, now).type, "none");
});

test("sustained inactivity remains non-escalating", () => {
  const context = { state: "TRACKING", recent: [at(-1000, 0, 0.2, 0.1), at(-500, 0, 0.1, 0.1)] };
  assert.equal(analyzeMotion(context, now).type, "none");
});

test("confirmation window is exactly 15 seconds", () => {
  const started = now;
  assert.equal(beginConfirmation(started).state, "CONFIRMATION");
  assert.equal(confirmationRemainingMs(started, now), 15000);
  assert.equal(shouldTimeoutConfirmation(started, now + 14999), false);
  assert.equal(shouldTimeoutConfirmation(started, now + 15000), true);
});

test("tracking is available in manual and automatic modes", () => {
  assert.equal(beginTracking("manual"), "TRACKING");
  assert.equal(beginTracking("automatic"), "TRACKING");
});

test("cancellation is an explicit terminal state", () => {
  assert.equal(cancelEmergency(), "CANCELLED");
});
