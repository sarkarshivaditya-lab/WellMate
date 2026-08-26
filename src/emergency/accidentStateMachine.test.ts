import { describe, expect, it } from "vitest";
import {
  AccidentStateMachine,
  DEFAULT_ACCIDENT_DETECTION_CONFIG,
} from "./accidentStateMachine";

describe("AccidentStateMachine", () => {
  const signal = (overrides: Partial<Parameters<AccidentStateMachine["ingest"]>[0]> = {}) => ({
    timestamp: 0,
    speedMps: 0,
    accelerationMagnitudeG: 0,
    angularVelocityDps: 0,
    sensorAvailable: true,
    locationAvailable: true,
    ...overrides,
  });

  it("starts in IDLE and enters TRACKING", () => {
    const machine = new AccidentStateMachine();
    expect(machine.getSnapshot().state).toBe("IDLE");
    machine.start(0);
    expect(machine.getSnapshot().state).toBe("TRACKING");
  });

  it("does not escalate on a normal stop", () => {
    const machine = new AccidentStateMachine();
    machine.start(0);
    machine.ingest(signal({ timestamp: 10_000, speedMps: 3 }));
    const result = machine.ingest(signal({ timestamp: 18_000, speedMps: 0 }));
    expect(result.type).toBe("NONE");
    expect(machine.getSnapshot().state).not.toBe("CONFIRMATION_WINDOW");
  });

  it("ignores GPS jitter while stationary", () => {
    const machine = new AccidentStateMachine();
    machine.start(0);
    const result = machine.ingest(signal({ timestamp: 20_000, speedMps: 0.4 }));
    expect(result.type).toBe("NONE");
    expect(machine.getSnapshot().state).not.toBe("CONFIRMATION_WINDOW");
  });

  it("requires suspicious movement before abrupt-stop escalation", () => {
    const machine = new AccidentStateMachine();
    machine.start(0);
    machine.ingest(signal({ timestamp: 1_000, speedMps: 8 }));
    machine.ingest(signal({
      timestamp: 2_000,
      speedMps: 3,
      accelerationMagnitudeG: DEFAULT_ACCIDENT_DETECTION_CONFIG.suspiciousAccelerationG,
    }));
    const result = machine.ingest(signal({ timestamp: 4_000, speedMps: 0 }));
    expect(result.type).toBe("START_CONFIRMATION");
    expect(machine.getSnapshot().state).toBe("CONFIRMATION_WINDOW");
  });

  it("starts confirmation after sustained inactivity following suspicious motion", () => {
    const machine = new AccidentStateMachine();
    machine.start(0);
    machine.ingest(signal({ timestamp: 1_000, speedMps: 5, angularVelocityDps: 300 }));
    const result = machine.ingest(signal({ timestamp: 10_000, speedMps: 0 }));
    expect(result.type).toBe("START_CONFIRMATION");
    expect(machine.getSnapshot().confirmationDeadlineAt).toBe(25_000);
  });

  it("freezes sensor transitions during confirmation", () => {
    const machine = new AccidentStateMachine();
    machine.start(0);
    machine.ingest(signal({ timestamp: 1_000, speedMps: 5, accelerationMagnitudeG: 3 }));
    machine.ingest(signal({ timestamp: 10_000, speedMps: 0 }));
    expect(machine.getSnapshot().state).toBe("CONFIRMATION_WINDOW");
    expect(machine.ingest(signal({ timestamp: 11_000, speedMps: 20 })).type).toBe("NONE");
    expect(machine.getSnapshot().state).toBe("CONFIRMATION_WINDOW");
  });

  it("supports immediate user cancellation", () => {
    const machine = new AccidentStateMachine();
    machine.start(0);
    machine.ingest(signal({ timestamp: 1_000, speedMps: 5, accelerationMagnitudeG: 3 }));
    machine.ingest(signal({ timestamp: 10_000, speedMps: 0 }));
    expect(machine.userIsOk().type).toBe("CANCEL");
    expect(machine.getSnapshot().state).toBe("CANCELLED");
  });

  it("escalates immediately when user says they are not ok", () => {
    const machine = new AccidentStateMachine();
    machine.start(0);
    machine.ingest(signal({ timestamp: 1_000, speedMps: 5, accelerationMagnitudeG: 3 }));
    machine.ingest(signal({ timestamp: 10_000, speedMps: 0 }));
    expect(machine.userIsNotOk()).toEqual({ type: "ESCALATE", reason: "USER_NOT_OK" });
    expect(machine.getSnapshot().state).toBe("ESCALATING");
  });

  it("escalates after the confirmation timeout", () => {
    const machine = new AccidentStateMachine();
    machine.start(0);
    machine.ingest(signal({ timestamp: 1_000, speedMps: 5, accelerationMagnitudeG: 3 }));
    machine.ingest(signal({ timestamp: 10_000, speedMps: 0 }));
    expect(machine.tick(24_999).type).toBe("NONE");
    expect(machine.tick(25_000)).toEqual({ type: "ESCALATE", reason: "TIMEOUT" });
  });

  it("fails safe when both sensor and location are unavailable", () => {
    const machine = new AccidentStateMachine();
    const result = machine.ingest(signal({ sensorAvailable: false, locationAvailable: false }));
    expect(result.type).toBe("UNAVAILABLE");
    expect(machine.getSnapshot().state).toBe("UNAVAILABLE");
  });

  it("does not reopen confirmation after escalation starts", () => {
    const machine = new AccidentStateMachine();
    machine.start(0);
    machine.ingest(signal({ timestamp: 1_000, speedMps: 5, accelerationMagnitudeG: 3 }));
    machine.ingest(signal({ timestamp: 10_000, speedMps: 0 }));
    expect(machine.tick(25_000).type).toBe("ESCALATE");
    expect(machine.ingest(signal({ timestamp: 26_000, speedMps: 0, accelerationMagnitudeG: 4 })).type).toBe("NONE");
  });
});
