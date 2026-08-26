export type HardwareShortcutCapability = "SUPPORTED" | "REQUIRES_USER" | "UNAVAILABLE";

export interface HardwareEmergencyShortcut {
  getCapability(): HardwareShortcutCapability;
  start(onTrigger: () => void): Promise<() => Promise<void>>;
}

/**
 * A normal browser/Capacitor WebView cannot intercept three physical power-button
 * presses. This adapter deliberately reports the limitation instead of faking it.
 * Native OS-level emergency shortcuts can be added behind this interface later.
 */
export class UnsupportedHardwareEmergencyShortcut implements HardwareEmergencyShortcut {
  public getCapability(): HardwareShortcutCapability {
    return "UNAVAILABLE";
  }

  public async start(): Promise<() => Promise<void>> {
    return async () => undefined;
  }
}
