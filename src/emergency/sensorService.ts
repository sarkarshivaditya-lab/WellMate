import type { AccidentSignal } from "./accidentStateMachine";

export type SensorAvailability = {
  location: boolean;
  accelerometer: boolean;
  gyroscope: boolean;
};

export type SensorPermissionStatus = "granted" | "denied" | "prompt" | "unavailable";

export type SensorServiceStatus = {
  availability: SensorAvailability;
  locationPermission: SensorPermissionStatus;
  motionPermission: SensorPermissionStatus;
};

export interface EmergencySensorAdapter {
  getStatus(): Promise<SensorServiceStatus>;
  requestMotionPermission?(): Promise<SensorPermissionStatus>;
  startLocation(options: { intervalMs: number; onSignal: (signal: AccidentSignal) => void }): Promise<() => void>;
  stopLocation(): Promise<void>;
  startMotion(options: { onSignal: (signal: AccidentSignal) => void }): Promise<() => void>;
  stopMotion(): Promise<void>;
}

const MAX_ACCEPTABLE_ACCURACY_M = 100;
const MAX_PLAUSIBLE_SPEED_MPS = 90;
const MOTION_SAMPLE_INTERVAL_MS = 50;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const earthRadiusM = 6_371_000;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusM * Math.asin(Math.sqrt(h));
}

export class BrowserEmergencySensorAdapter implements EmergencySensorAdapter {
  private locationStop: (() => void) | null = null;
  private motionStop: (() => void) | null = null;
  private previousLocation: { latitude: number; longitude: number; timestamp: number } | null = null;

  public async getStatus(): Promise<SensorServiceStatus> {
    const location = typeof navigator !== "undefined" && "geolocation" in navigator;
    const accelerometer = typeof window !== "undefined" && "DeviceMotionEvent" in window;
    const gyroscope = typeof window !== "undefined" && "DeviceMotionEvent" in window;

    let motionPermission: SensorPermissionStatus = accelerometer ? "prompt" : "unavailable";
    if (
      typeof window !== "undefined" &&
      "DeviceMotionEvent" in window &&
      typeof (window.DeviceMotionEvent as typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> }).requestPermission === "function"
    ) {
      motionPermission = "prompt";
    }

    return {
      availability: { location, accelerometer, gyroscope },
      locationPermission: location ? "prompt" : "unavailable",
      motionPermission,
    };
  }

  public async requestMotionPermission(): Promise<SensorPermissionStatus> {
    if (typeof window === "undefined" || !("DeviceMotionEvent" in window)) return "unavailable";

    const eventType = window.DeviceMotionEvent as typeof DeviceMotionEvent & {
      requestPermission?: () => Promise<string>;
    };
    if (typeof eventType.requestPermission !== "function") return "granted";

    try {
      const result = await eventType.requestPermission();
      return result === "granted" ? "granted" : "denied";
    } catch {
      return "denied";
    }
  }

  public async startLocation(options: {
    intervalMs: number;
    onSignal: (signal: AccidentSignal) => void;
  }): Promise<() => void> {
    if (!navigator.geolocation) throw new Error("Geolocation is unavailable");

    let lastEmittedAt = 0;
    this.previousLocation = null;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastEmittedAt < options.intervalMs) return;

        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const accuracyM = position.coords.accuracy;

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
        if (!Number.isFinite(accuracyM) || accuracyM > MAX_ACCEPTABLE_ACCURACY_M) return;

        let derivedSpeedMps: number | undefined = position.coords.speed ?? undefined;
        if (this.previousLocation) {
          const elapsedS = (now - this.previousLocation.timestamp) / 1000;
          if (elapsedS > 0) {
            const distanceM = haversineMeters(this.previousLocation, { latitude, longitude });
            const computed = distanceM / elapsedS;
            if (computed <= MAX_PLAUSIBLE_SPEED_MPS) derivedSpeedMps = computed;
          }
        }

        this.previousLocation = { latitude, longitude, timestamp: now };
        lastEmittedAt = now;

        options.onSignal({
          timestamp: now,
          speedMps: derivedSpeedMps,
          position: { latitude, longitude, accuracyM },
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
      {
        enableHighAccuracy: true,
        maximumAge: Math.min(10_000, options.intervalMs),
        timeout: Math.max(options.intervalMs, 15_000),
      },
    );

    const stop = () => {
      navigator.geolocation.clearWatch(watchId);
      this.previousLocation = null;
    };
    this.locationStop = stop;
    return stop;
  }

  public async stopLocation(): Promise<void> {
    this.locationStop?.();
    this.locationStop = null;
  }

  public async startMotion(options: { onSignal: (signal: AccidentSignal) => void }): Promise<() => void> {
    if (typeof window === "undefined" || !("DeviceMotionEvent" in window)) {
      throw new Error("Motion sensors are unavailable");
    }

    const permission = await this.requestMotionPermission?.();
    if (permission === "denied" || permission === "unavailable") {
      throw new Error("Motion sensor permission was denied or is unavailable");
    }

    let lastMotionAt = 0;
    const onMotion = (event: DeviceMotionEvent) => {
      const now = Date.now();
      if (now - lastMotionAt < MOTION_SAMPLE_INTERVAL_MS) return;
      lastMotionAt = now;

      const acceleration = event.accelerationIncludingGravity;
      const x = acceleration?.x ?? 0;
      const y = acceleration?.y ?? 0;
      const z = acceleration?.z ?? 0;
      const magnitudeG = Math.sqrt(x * x + y * y + z * z) / 9.80665;

      const rotation = event.rotationRate;
      const alpha = rotation?.alpha ?? 0;
      const beta = rotation?.beta ?? 0;
      const gamma = rotation?.gamma ?? 0;
      const angularVelocityDps = Math.sqrt(alpha * alpha + beta * beta + gamma * gamma);

      options.onSignal({
        timestamp: now,
        accelerationMagnitudeG: magnitudeG,
        angularVelocityDps,
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

  public requestMotionPermission(): Promise<SensorPermissionStatus> {
    return this.adapter.requestMotionPermission?.() ?? Promise.resolve("unavailable");
  }

  public startAutomaticMode(
    onSignal: (signal: AccidentSignal) => void,
    locationIntervalMs = 20_000,
  ): Promise<() => Promise<void>> {
    return this.adapter.startLocation({
      intervalMs: locationIntervalMs,
      onSignal,
    }).then((locationStop) => async () => {
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
