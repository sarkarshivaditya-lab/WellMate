import type { AccidentSignal } from "./accidentStateMachine";

export type SensorAvailability = {
  location: boolean;
  accelerometer: boolean;
  gyroscope: boolean;
};

export type SensorPermissionStatus =
  | "granted"
  | "denied"
  | "prompt"
  | "unavailable";

export type SensorServiceStatus = {
  availability: SensorAvailability;
  locationPermission: SensorPermissionStatus;
  motionPermission: SensorPermissionStatus;
};

export interface EmergencySensorAdapter {
  getStatus(): Promise<SensorServiceStatus>;
  startLocation(options: { intervalMs: number; onSignal: (signal: AccidentSignal) => void }): Promise<() => void>;
  stopLocation(): Promise<void>;
  startMotion(options: { onSignal: (signal: AccidentSignal) => void }): Promise<() => void>;
  stopMotion(): Promise<void>;
}

export class BrowserEmergencySensorAdapter implements EmergencySensorAdapter {
  private locationStop: (() => void) | null = null;
  private motionStop: (() => void) | null = null;

  public async getStatus(): Promise<SensorServiceStatus> {
    const location = typeof navigator !== "undefined" && "geolocation" in navigator;
    const accelerometer = typeof window !== "undefined" && "DeviceMotionEvent" in window;
    const gyroscope = typeof window !== "undefined" && "DeviceOrientationEvent" in window;

    return {
      availability: { location, accelerometer, gyroscope },
      locationPermission: location ? "prompt" : "unavailable",
      motionPermission: accelerometer || gyroscope ? "prompt" : "unavailable",
    };
  }

  public async startLocation(options: {
    intervalMs: number;
    onSignal: (signal: AccidentSignal) => void;
  }): Promise<() => void> {
    if (!navigator.geolocation) {
      throw new Error("Geolocation is unavailable");
    }

    let lastEmittedAt = 0;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastEmittedAt < options.intervalMs) return;
        lastEmittedAt = now;
        options.onSignal({
          timestamp: now,
          speedMps: position.coords.speed ?? undefined,
          position: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyM: position.coords.accuracy,
          },
          sensorAvailable: false,
          locationAvailable: true,
        });
      },
      () => {
        options.onSignal({
          timestamp: Date.now(),
          sensorAvailable: false,
          locationAvailable: false,
        });
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: Math.max(options.intervalMs, 15_000) },
    );

    const stop = () => navigator.geolocation.clearWatch(watchId);
    this.locationStop = stop;
    return stop;
  }

  public async stopLocation(): Promise<void> {
    this.locationStop?.();
    this.locationStop = null;
  }

  public async startMotion(options: { onSignal: (signal: AccidentSignal) => void }): Promise<() => void> {
    if (!("DeviceMotionEvent" in window) && !("DeviceOrientationEvent" in window)) {
      throw new Error("Motion sensors are unavailable");
    }

    const onMotion = (event: DeviceMotionEvent) => {
      const acceleration = event.accelerationIncludingGravity;
      const x = acceleration?.x ?? 0;
      const y = acceleration?.y ?? 0;
      const z = acceleration?.z ?? 0;
      const magnitudeG = Math.sqrt(x * x + y * y + z * z) / 9.80665;

      options.onSignal({
        timestamp: Date.now(),
        accelerationMagnitudeG: magnitudeG,
        angularVelocityDps: undefined,
        sensorAvailable: true,
        locationAvailable: false,
      });
    };

    window.addEventListener("devicemotion", onMotion);
    const stop = () => window.removeEventListener("devicemotion", onMotion);
    this.motionStop = stop;
    return stop;
  }

  public async stopMotion(): Promise<void> {
    this.motionStop?.();
    this.motionStop = null;
  }
}

export class EmergencySensorService {
  public constructor(private readonly adapter: EmergencySensorAdapter) {}

  public getStatus(): Promise<SensorServiceStatus> {
    return this.adapter.getStatus();
  }

  public startAutomaticMode(
    onSignal: (signal: AccidentSignal) => void,
    locationIntervalMs = 20_000,
  ): Promise<() => Promise<void>> {
    let motionStop: (() => void) | null = null;

    return this.adapter.startLocation({
      intervalMs: locationIntervalMs,
      onSignal: (signal) => {
        onSignal(signal);
      },
    }).then((locationStop) => async () => {
      motionStop?.();
      motionStop = null;
      locationStop();
      await this.adapter.stopLocation();
    });
  }

  public async startMotion(onSignal: (signal: AccidentSignal) => void): Promise<() => Promise<void>> {
    const motionStop = await this.adapter.startMotion({ onSignal });
    return async () => {
      motionStop();
      await this.adapter.stopMotion();
    };
  }

  public stopAll(): Promise<void> {
    return Promise.all([this.adapter.stopLocation(), this.adapter.stopMotion()]).then(() => undefined);
  }
}
