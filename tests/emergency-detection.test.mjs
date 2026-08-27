import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeMotion,
  beginConfirmation,
  beginTracking,
  confirmationRemainingMs,
  distanceMeters,
  shouldTimeoutConfirmation,
  speedFromGps,
} from "../src/emergency/detection.ts";

const at = (timestampMs, speedMps, accelerationG, rotationMagnitude) => ({
  timestampMs,
  speedMps,
  accelerationG,
  rotationMagnitude,
  locationAccuracyM: 10,
});

test("normal movement enters MOVING", () => {
  assert.equal(analyzeMotion({ state: "TRACKING", recent: [at(1000, 2)] }).nextState, "MOVING");
});

test("normal stop does not become an accident", () => {
  const context = { state: "MOVING", recent: [at(1000, 1.8, 0.4, 0.2), at(2200, 0.2, 0.3, 0.2)] };
  assert.notEqual(analyzeMotion(context).type, "abrupt_stop");
});

test("GPS distance/time derives movement speed", () => {
  const a = { timestampMs: 0, latitude: 0, longitude: 0, accuracyM: 5 };
  const b = { timestampMs: 1000, latitude: 0, longitude: 0.00002, accuracyM: 5 };
  assert.ok(distanceMeters(a, b) > 1);
  assert.ok(speedFromGps(a, b) > 1);
});

test("GPS jitter with poor accuracy is ignored", () => {
  const a = { timestampMs: 0, latitude: 0, longitude: 0, accuracyM: 120 };
  const b = { timestampMs: 1000, latitude: 1, longitude: 1, accuracyM: 120 };
  assert.equal(speedFromGps(a, b), null);
});

test("single hard acceleration does not escalate", () => {
  assert.equal(analyzeMotion({ state: "TRACKING", recent: [at(1000, 2.3, 3.4, 0.2)] }).nextState, "SUSPICIOUS_MOTION");
});

test("sustained suspicious motion followed by corroborated stop confirms", () => {
  const context = {
    state: "SUSPICIOUS_MOTION",
    recent: [at(1000, 3, 3.1, 2.9), at(1400, 2.8, 2.7, 2.7), at(2200, 0.2, 1.5, 1.1), at(2500, 0.1, 1.4, 1.2)],
  };
  assert.equal(analyzeMotion(context).type, "abrupt_stop");
});

test("unavailable motion does not trigger", () => {
  assert.equal(analyzeMotion({ state: "TRACKING", recent: [] }).type, "none");
});

test("confirmation window is exactly 15 seconds", () => {
  assert.equal(beginConfirmation(10_000).state, "CONFIRMATION");
  assert.equal(confirmationRemainingMs(10_000, 18_000), 7000);
  assert.equal(shouldTimeoutConfirmation(10_000, 24_999), false);
  assert.equal(shouldTimeoutConfirmation(10_000, 25_000), true);
});

test("tracking is available in manual and automatic modes", () => {
  assert.equal(beginTracking("manual"), "TRACKING");
  assert.equal(beginTracking("automatic"), "TRACKING");
});
