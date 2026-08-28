import { Capacitor } from "@capacitor/core";
import type { TrackingMode } from "./detection";

export type DeliveryStatus = "PENDING" | "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED";
export type PowerShortcutStatus = "SUPPORTED" | "UNSUPPORTED" | "FALLBACK";

export type EmergencyProfile = {
  bloodType: string;
  allergies: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  localAmbulanceNumber: string;
  trackingMode: TrackingMode;
};

export type EmergencyEvent = {
  state: "CONFIRMATION" | "ESCALATING" | "ESCALATED" | "CANCELLED";
  location?: { latitude: number; longitude: number; accuracy?: number };
  profile: EmergencyProfile;
  occurredAtMs: number;
  reason?: "explicit" | "timeout";
};

export type DispatchResult = {
  call: DeliveryStatus;
  sms: DeliveryStatus;
  overall: DeliveryStatus;
};

export interface EmergencyDispatcher {
  dispatch(event: EmergencyEvent): Promise<DispatchResult>;
}

function buildSmsBody(event: EmergencyEvent): string {
  const location = event.location
    ? `https://maps.google.com/?q=${event.location.latitude},${event.location.longitude}`
    : "Location unavailable";
  return [
    "WellMate emergency alert.",
    `State: ${event.state}`,
    `Blood type: ${event.profile.bloodType || "unknown"}`,
    `Allergies: ${event.profile.allergies || "none recorded"}`,
    `Location: ${location}`,
    `Local ambulance: ${event.profile.localAmbulanceNumber || "not configured"}`,
  ].join(" ");
}

function openCall(phone: string): DeliveryStatus {
  if (!phone || typeof window === "undefined") return "FAILED";
  window.location.assign(`tel:${phone}`);
  return "PENDING";
}

function openSms(phone: string, body: string): DeliveryStatus {
  if (!phone || typeof window === "undefined") return "FAILED";
  window.location.assign(`sms:${phone}?body=${encodeURIComponent(body)}`);
  return "PENDING";
}

export class WebEmergencyDispatcher implements EmergencyDispatcher {
  async dispatch(event: EmergencyEvent): Promise<DispatchResult> {
    const phone = event.profile.emergencyContactPhone;
    const sms = openSms(phone, buildSmsBody(event));
    return {
      call: "PENDING",
      sms,
      overall: sms === "FAILED" ? "FAILED" : "PENDING",
    };
  }
}

export class NativeEmergencyDispatcher implements EmergencyDispatcher {
  async dispatch(event: EmergencyEvent): Promise<DispatchResult> {
    if (!Capacitor.isNativePlatform()) {
      return { call: "FAILED", sms: "FAILED", overall: "FAILED" };
    }

    const phone = event.profile.emergencyContactPhone;
    const sms = openSms(phone, buildSmsBody(event));

    return {
      call: "PENDING",
      sms,
      overall: sms === "FAILED" ? "FAILED" : "PENDING",
    };
  }
}

export function createEmergencyDispatcher(): EmergencyDispatcher {
  return Capacitor.isNativePlatform()
    ? new NativeEmergencyDispatcher()
    : new WebEmergencyDispatcher();
}

export function getPowerShortcutStatus(): PowerShortcutStatus {
  if (!Capacitor.isNativePlatform()) return "UNSUPPORTED";
  return "FALLBACK";
}

export function getLocationReadinessMessage(location: EmergencyEvent["location"]): string {
  return location
    ? "Location ready"
    : "Location unavailable — escalation can still be prepared";
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
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 8_000 },
    );
  });
}

export function buildEmergencyEvent(
  profile: EmergencyProfile,
  state: EmergencyEvent["state"],
  location?: EmergencyEvent["location"],
  reason?: EmergencyEvent["reason"],
): EmergencyEvent {
  return {
    state,
    location,
    profile,
    occurredAtMs: Date.now(),
    reason,
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

export function getDeliveryStatus(
  hasDispatcher: boolean,
  dispatcherSucceeded?: boolean,
): DeliveryStatus {
  if (!hasDispatcher) return "PENDING";
  if (dispatcherSucceeded === true) return "SUCCESS";
  if (dispatcherSucceeded === false) return "FAILED";
  return "PENDING";
}
