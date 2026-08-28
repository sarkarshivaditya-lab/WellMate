import {
  AccidentStateMachine,
  type AccidentDetectionAction,
  type AccidentSignal,
  type AccidentState,
} from "./accidentStateMachine";
import { EmergencySensorService } from "./sensorService";
import { AutomaticTrackingPolicy } from "./automaticTracking";
import {
  createEmergencyEvent,
  escalateEmergency,
  type EmergencyEscalationAdapter,
  type EmergencyEscalationResult,
} from "./emergencyEscalation";
import { readCurrentLocation } from "./emergencyService";
import type { LocalProfile } from "@/hooks/useLocalProfile";

export type TrackingMode = "AUTOMATIC" | "MANUAL";
export type EmergencyCallCapability = "SUPPORTED" | "REQUIRES_USER" | "UNAVAILABLE";
export type TrackingSnapshot = {
  mode: TrackingMode | null;
  state: AccidentState;
  trackingActive: boolean;
  confirmationDeadlineAt: number | null;
  latestSignal: AccidentSignal | null;
  lastEscalation: EmergencyEscalationResult | null;
  error: string | null;
};
export type TrackingListener = (snapshot: TrackingSnapshot) => void;

export class EmergencyTrackingController {
  private readonly stateMachine: AccidentStateMachine;
  private readonly automaticPolicy: AutomaticTrackingPolicy;
  private locationStop: (() => Promise<void>) | null = null;
  private motionStop: (() => Promise<void>) | null = null;
  private confirmationTimer: ReturnType<typeof setInterval> | null = null;
  private latestSignal: AccidentSignal | null = null;
  private mode: TrackingMode | null = null;
  private lastEscalationAt = 0;
  private lastEscalation: EmergencyEscalationResult | null = null;
  private error: string | null = null;
  private listeners = new Set<TrackingListener>();

  public constructor(
    private readonly sensors: EmergencySensorService,
    private readonly profileProvider: () => LocalProfile | null,
    private readonly escalationAdapter: EmergencyEscalationAdapter,
  ) {
    this.stateMachine = new AccidentStateMachine();
    this.automaticPolicy = new AutomaticTrackingPolicy();
  }

  public subscribe(listener: TrackingListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  public getSnapshot(): TrackingSnapshot {
    const machine = this.stateMachine.getSnapshot();
    return {
      mode: this.mode,
      state: machine.state,
      trackingActive: this.mode !== null && !["IDLE", "CANCELLED", "FAILED", "UNAVAILABLE"].includes(machine.state),
      confirmationDeadlineAt: machine.confirmationDeadlineAt,
      latestSignal: this.latestSignal,
      lastEscalation: this.lastEscalation,
      error: this.error,
    };
  }

  public async start(mode: TrackingMode): Promise<void> {
    await this.stop(false);
    this.mode = mode;
    this.error = null;
    this.latestSignal = null;
    this.stateMachine.start(Date.now());
    this.publish();

    const onSignal = (signal: AccidentSignal) => this.handleSignal(signal);
    const failures: string[] = [];

    const [motionResult, locationResult] = await Promise.allSettled([
      this.sensors.startMotion(onSignal),
      this.sensors.startAutomaticMode(onSignal, 2_000),
    ]);

    if (motionResult.status === "fulfilled") {
      this.motionStop = motionResult.value;
    } else {
      failures.push(motionResult.reason instanceof Error ? motionResult.reason.message : "Motion sensors unavailable");
    }

    if (locationResult.status === "fulfilled") {
      this.locationStop = locationResult.value;
    } else {
      failures.push(locationResult.reason instanceof Error ? locationResult.reason.message : "Location unavailable");
    }

    if (motionResult.status === "rejected" && locationResult.status === "rejected") {
      this.error = failures.join("; ") || "Unable to start emergency sensors";
      this.stateMachine.markUnavailable();
    } else if (failures.length > 0) {
      this.error = failures.join("; ");
    }

    this.publish();
  }

  public async stop(resetMode = true): Promise<void> {
    if (this.confirmationTimer) {
      clearInterval(this.confirmationTimer);
      this.confirmationTimer = null;
    }
    await Promise.allSettled([
      this.locationStop?.() ?? Promise.resolve(),
      this.motionStop?.() ?? Promise.resolve(),
      this.automaticPolicy.stopMotion(),
      this.sensors.stopAll(),
    ]);
    this.locationStop = null;
    this.motionStop = null;
    this.stateMachine.stop();
    if (resetMode) this.mode = null;
    this.publish();
  }

  public async userIsOk(): Promise<void> {
    this.stateMachine.userIsOk();
    if (this.confirmationTimer) {
      clearInterval(this.confirmationTimer);
      this.confirmationTimer = null;
    }
    this.publish();
    if (this.mode) await this.start(this.mode);
  }

  public async userIsNotOk(): Promise<void> {
    const action = this.stateMachine.userIsNotOk();
    if (action.type !== "ESCALATE") return;
    await this.escalate(action.reason);
  }

  public async manualEmergency(): Promise<void> {
    await this.escalate("MANUAL");
  }

  public requestEmergencyCall(): Promise<EmergencyCallCapability> {
    return this.escalationAdapter.requestEmergencyCall();
  }

  private handleSignal(signal: AccidentSignal): void {
    this.latestSignal = signal;
    const action = this.stateMachine.ingest(signal);
    this.handleAction(action);
    this.publish();
  }

  private handleAction(action: AccidentDetectionAction): void {
    if (action.type !== "START_CONFIRMATION") return;
    if (this.confirmationTimer) clearInterval(this.confirmationTimer);
    this.confirmationTimer = setInterval(() => {
      const next = this.stateMachine.tick(Date.now());
      if (next.type === "ESCALATE") {
        if (this.confirmationTimer) {
          clearInterval(this.confirmationTimer);
          this.confirmationTimer = null;
        }
        void this.escalate(next.reason);
      }
      this.publish();
    }, 250);
  }

  private async escalate(reason: "TIMEOUT" | "USER_NOT_OK" | "MANUAL" | "SHORTCUT"): Promise<void> {
    const now = Date.now();
    if (now - this.lastEscalationAt < 30_000) return;
    this.lastEscalationAt = now;
    if (this.confirmationTimer) {
      clearInterval(this.confirmationTimer);
      this.confirmationTimer = null;
    }

    const profile = this.profileProvider();
    const contacts = profile?.emergencyContactPhone
      ? [{ id: "primary", name: profile.emergencyContactName || "Emergency contact", phone: profile.emergencyContactPhone }]
      : [];
    const allergies = profile?.allergies
      ? profile.allergies.split(",").map((item) => item.trim()).filter(Boolean)
      : [];

    const trackedLocation = this.latestSignal?.position;
    const freshLocation = trackedLocation ? null : await readCurrentLocation();
    const position = trackedLocation ?? freshLocation;
    const location = position ? { ...position, capturedAt: Date.now() } : null;

    const event = createEmergencyEvent({
      triggeredAt: now,
      reason,
      location,
      profile: { bloodType: profile?.bloodType, allergies },
      contacts,
    });
    const result = await escalateEmergency(this.escalationAdapter, event);
    this.lastEscalation = result;
    this.stateMachine.markEscalated(now);
    this.publish();
  }

  private publish(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // A UI listener must never break emergency processing.
      }
    }
  }
}
