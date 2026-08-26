import type { AccidentSignal } from "./accidentStateMachine";
import type { EmergencySensorAdapter } from "./sensorService";

const MOVEMENT_SPEED_MPS = 1.4;

export class AutomaticTrackingPolicy {
  private motionStop: (() => void) | null = null;
  private motionActive = false;

  public constructor(private readonly adapter: EmergencySensorAdapter) {}

  public async handleLocationSignal(
    signal: AccidentSignal,
    onSignal: (signal: AccidentSignal) => void,
  ): Promise<void> {
    onSignal(signal);

    const moving = (signal.speedMps ?? 0) >= MOVEMENT_SPEED_MPS;
    if (moving && !this.motionActive && signal.sensorAvailable !== false) {
      await this.startMotion(onSignal);
      return;
    }

    if (!moving && this.motionActive) {
      await this.stopMotion();
    }
  }

  public async startMotion(onSignal: (signal: AccidentSignal) => void): Promise<void> {
    if (this.motionActive) return;
    const stop = await this.adapter.startMotion({ onSignal });
    this.motionStop = stop;
    this.motionActive = true;
  }

  public async stopMotion(): Promise<void> {
    this.motionStop?.();
    this.motionStop = null;
    this.motionActive = false;
    await this.adapter.stopMotion();
  }
}
