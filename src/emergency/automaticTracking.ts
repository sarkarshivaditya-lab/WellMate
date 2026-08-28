import type { AccidentSignal } from "./accidentStateMachine";

export class AutomaticTrackingPolicy {
  public async handleLocationSignal(
    signal: AccidentSignal,
    onSignal: (signal: AccidentSignal) => void,
  ): Promise<void> {
    onSignal(signal);
  }

  public async stopMotion(): Promise<void> {
    return;
  }
}
