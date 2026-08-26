import type { AccidentSignal } from "./accidentStateMachine";
import type { EmergencySensorService } from "./sensorService";

const MOVEMENT_SPEED_MPS = 1.4;

export class AutomaticTrackingPolicy {
  private motionStop: (() => Promise<void>) | null = null;
  private motionActive = false;

  public constructor(private readonly sensors: EmergencySensorService) {}

  public async handleLocationSignal(
    signal: AccidentSignal,
    onSignal: (signal: AccidentSignal) => void,
  ): Promise<void> {
    onSignal(signal);

    const moving = (signal.speedMps ?? 0) >= MOVEMENT_SPEED_MPS;
    if (moving && !this.motionActive) {
      this.motionStop = await this.sensors.startMotion(onSignal);
      this.motionActive = true;
      return;
    }

    if (!moving && this.motionActive) {
      await this.stopMotion();
    }
  }

  public async stopMotion(): Promise<void> {
    await this.motionStop?.();
    this.motionStop = null;
    this.motionActive = false;
  }
}
