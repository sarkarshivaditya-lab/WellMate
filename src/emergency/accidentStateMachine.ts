export type AccidentState =
  | "IDLE"
  | "TRACKING"
  | "MOTION_DETECTED"
  | "SUSPICIOUS_MOTION"
  | "POSSIBLE_ACCIDENT"
  | "CONFIRMATION_WINDOW"
  | "ESCALATING"
  | "ESCALATED"
  | "CANCELLED"
  | "FAILED"
  | "UNAVAILABLE";

export type AccidentSignal = {
  timestamp: number;
  speedMps?: number;
  accelerationMagnitudeG?: number;
  angularVelocityDps?: number;
  position?: { latitude: number; longitude: number; accuracyM?: number };
  sensorAvailable: boolean;
  locationAvailable: boolean;
};

export type AccidentDetectionConfig = {
  movementSpeedMps: number;
  suspiciousAccelerationG: number;
  suspiciousAngularVelocityDps: number;
  abruptStopSpeedDeltaMps: number;
  sustainedInactivityMs: number;
  suspiciousWindowMs: number;
  confirmationWindowMs: number;
  duplicateEventWindowMs: number;
};

export const DEFAULT_ACCIDENT_DETECTION_CONFIG: AccidentDetectionConfig = {
  movementSpeedMps: 1.4,
  suspiciousAccelerationG: 2.6,
  suspiciousAngularVelocityDps: 240,
  abruptStopSpeedDeltaMps: 4.5,
  sustainedInactivityMs: 8_000,
  suspiciousWindowMs: 8_000,
  confirmationWindowMs: 15_000,
  duplicateEventWindowMs: 30_000,
};

export type AccidentDetectionSnapshot = {
  state: AccidentState;
  previousSpeedMps: number | null;
  lastMeaningfulMovementAt: number | null;
  suspiciousMotionAt: number | null;
  possibleAccidentAt: number | null;
  confirmationDeadlineAt: number | null;
  lastEscalationAt: number | null;
};

export type AccidentDetectionAction =
  | { type: "NONE" }
  | { type: "START_CONFIRMATION"; deadlineAt: number }
  | { type: "ESCALATE"; reason: "TIMEOUT" | "USER_NOT_OK" }
  | { type: "CANCEL" }
  | { type: "UNAVAILABLE" };

function hasMeaningfulMovement(signal: AccidentSignal, config: AccidentDetectionConfig): boolean {
  return (signal.speedMps ?? 0) >= config.movementSpeedMps;
}

function hasSuspiciousMotion(signal: AccidentSignal, config: AccidentDetectionConfig): boolean {
  return (
    (signal.accelerationMagnitudeG ?? 0) >= config.suspiciousAccelerationG ||
    (signal.angularVelocityDps ?? 0) >= config.suspiciousAngularVelocityDps
  );
}

export class AccidentStateMachine {
  private snapshot: AccidentDetectionSnapshot = {
    state: "IDLE",
    previousSpeedMps: null,
    lastMeaningfulMovementAt: null,
    suspiciousMotionAt: null,
    possibleAccidentAt: null,
    confirmationDeadlineAt: null,
    lastEscalationAt: null,
  };

  public constructor(
    private readonly config: AccidentDetectionConfig = DEFAULT_ACCIDENT_DETECTION_CONFIG,
  ) {}

  public getSnapshot(): AccidentDetectionSnapshot {
    return { ...this.snapshot };
  }

  public start(timestamp: number): AccidentDetectionAction {
    if (this.snapshot.state === "ESCALATED" || this.snapshot.state === "ESCALATING") {
      return { type: "NONE" };
    }

    this.snapshot = {
      ...this.snapshot,
      state: "TRACKING",
      previousSpeedMps: null,
      lastMeaningfulMovementAt: timestamp,
      suspiciousMotionAt: null,
      possibleAccidentAt: null,
      confirmationDeadlineAt: null,
    };

    return { type: "NONE" };
  }

  public stop(): AccidentDetectionAction {
    this.snapshot = { ...this.snapshot, state: "IDLE", confirmationDeadlineAt: null };
    return { type: "CANCEL" };
  }

  public markUnavailable(): AccidentDetectionAction {
    this.snapshot = { ...this.snapshot, state: "UNAVAILABLE" };
    return { type: "UNAVAILABLE" };
  }

  public ingest(signal: AccidentSignal): AccidentDetectionAction {
    if (
      this.snapshot.state === "CONFIRMATION_WINDOW" ||
      this.snapshot.state === "ESCALATED" ||
      this.snapshot.state === "ESCALATING"
    ) {
      return { type: "NONE" };
    }

    if (!signal.locationAvailable && !signal.sensorAvailable) {
      return this.markUnavailable();
    }

    if (this.snapshot.state === "IDLE") {
      this.start(signal.timestamp);
    }

    const moving = hasMeaningfulMovement(signal, this.config);
    const suspicious = hasSuspiciousMotion(signal, this.config);
    const previousSpeed = this.snapshot.previousSpeedMps;
    const currentSpeed = signal.speedMps ?? 0;
    const abruptStop =
      previousSpeed !== null &&
      previousSpeed - currentSpeed >= this.config.abruptStopSpeedDeltaMps;

    if (moving) {
      this.snapshot.lastMeaningfulMovementAt = signal.timestamp;
      this.snapshot.state = suspicious ? "SUSPICIOUS_MOTION" : "MOTION_DETECTED";
      if (suspicious && this.snapshot.suspiciousMotionAt === null) {
        this.snapshot.suspiciousMotionAt = signal.timestamp;
      }
    } else if (this.snapshot.lastMeaningfulMovementAt !== null) {
      const inactivityMs = signal.timestamp - this.snapshot.lastMeaningfulMovementAt;
      const recentSuspicious =
        this.snapshot.suspiciousMotionAt !== null &&
        signal.timestamp - this.snapshot.suspiciousMotionAt <= this.config.suspiciousWindowMs;

      if (abruptStop && recentSuspicious) {
        this.snapshot.state = "POSSIBLE_ACCIDENT";
        this.snapshot.possibleAccidentAt = signal.timestamp;
      } else if (recentSuspicious && inactivityMs >= this.config.sustainedInactivityMs) {
        this.snapshot.state = "POSSIBLE_ACCIDENT";
        this.snapshot.possibleAccidentAt = signal.timestamp;
      } else if (inactivityMs >= this.config.sustainedInactivityMs) {
        this.snapshot.state = "TRACKING";
      }
    }

    if (signal.speedMps !== undefined) {
      this.snapshot.previousSpeedMps = signal.speedMps;
    }

    if (this.snapshot.state === "POSSIBLE_ACCIDENT" && this.snapshot.confirmationDeadlineAt === null) {
      const deadlineAt = signal.timestamp + this.config.confirmationWindowMs;
      this.snapshot.confirmationDeadlineAt = deadlineAt;
      this.snapshot.state = "CONFIRMATION_WINDOW";
      return { type: "START_CONFIRMATION", deadlineAt };
    }

    return { type: "NONE" };
  }

  public userIsOk(): AccidentDetectionAction {
    if (this.snapshot.state !== "CONFIRMATION_WINDOW") return { type: "NONE" };
    this.snapshot = {
      ...this.snapshot,
      state: "CANCELLED",
      confirmationDeadlineAt: null,
      possibleAccidentAt: null,
      suspiciousMotionAt: null,
    };
    return { type: "CANCEL" };
  }

  public userIsNotOk(): AccidentDetectionAction {
    if (this.snapshot.state !== "CONFIRMATION_WINDOW") return { type: "NONE" };
    this.snapshot = {
      ...this.snapshot,
      state: "ESCALATING",
      confirmationDeadlineAt: null,
      lastEscalationAt: Date.now(),
    };
    return { type: "ESCALATE", reason: "USER_NOT_OK" };
  }

  public tick(timestamp: number): AccidentDetectionAction {
    if (
      this.snapshot.state !== "CONFIRMATION_WINDOW" ||
      this.snapshot.confirmationDeadlineAt === null ||
      timestamp < this.snapshot.confirmationDeadlineAt
    ) {
      return { type: "NONE" };
    }

    this.snapshot = {
      ...this.snapshot,
      state: "ESCALATING",
      lastEscalationAt: timestamp,
      confirmationDeadlineAt: null,
    };

    return { type: "ESCALATE", reason: "TIMEOUT" };
  }

  public markEscalated(timestamp: number): void {
    this.snapshot.state = "ESCALATED";
    this.snapshot.lastEscalationAt = this.snapshot.lastEscalationAt ?? timestamp;
  }

  public markFailed(): void {
    this.snapshot.state = "FAILED";
  }
}
