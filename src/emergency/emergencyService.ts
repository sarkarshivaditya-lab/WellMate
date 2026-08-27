import { Capacitor } from "@capacitor/core";
import type { TrackingMode } from "./detection";

export type DeliveryStatus = "PENDING" | "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED";
export type PowerShortcutStatus = "SUPPORTED" | "UNSUPPORTED" | "FALLBACK";

export type EmergencyProfile = {
  bloodType: string;
  allergies: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  trackingMode: TrackingMode;
};

export type EmergencyEvent = {
  state: "CONFIRMATION" | "ESCALATING" | "ESCALATED" | "CANCELLED";
  location?: { latitude: number; longitude: number; accuracy?: number };
  profile: EmergencyProfile;
  occurredAtMs: number;
};

export function getPowerShortcutStatus(): PowerShortcutStatus {
  if (!Capacitor.isNativePlatform()) return "UNSUPPORTED";
  return "FALLBACK";
}

export function getLocationReadinessMessage(location: EmergencyEvent["location"]): string {
  return location ? "Location ready" : "Location unavailable — escalation can still be prepared";
}

export async function readCurrentLocation(): Promise<{
  latitude: number;
  longitude: number;
  accuracy?: number;
} | null> {
  if (!("geolocation" in navigator)) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: false, maximumAge: 10_000, timeout: 5_000 },
    );
  });
}

export function buildEmergencyEvent(
  profile: EmergencyProfile,
  state: EmergencyEvent["state"],
  location?: EmergencyEvent["location"],
): EmergencyEvent {
  return {
    state,
    location,
    profile,
    occurredAtMs: Date.now(),
  };
}

let escalationInFlight = false;

export function beginEscalation(): boolean {
  if (escalationInFlight) return false;
  escalationInFlight = true;
  return true;
}

export function completeEscalation(): void {
  escalationInFlight = false;
}

export function getDeliveryStatus(hasDispatcher: boolean, dispatcherSucceeded?: boolean): DeliveryStatus {
  if (!hasDispatcher) return "PENDING";
  if (dispatcherSucceeded === true) return "SUCCESS";
  if (dispatcherSucceeded === false) return "FAILED";
  return "PENDING";
}
