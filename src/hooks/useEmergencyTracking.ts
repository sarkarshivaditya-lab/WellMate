import { useEffect, useMemo, useState } from "react";
import { BrowserEmergencySensorAdapter, EmergencySensorService } from "@/emergency/sensorService";
import { BrowserCommunicationAdapter } from "@/emergency/platformCommunication";
import {
  EmergencyTrackingController,
  type EmergencyCallCapability,
  type TrackingMode,
  type TrackingSnapshot,
} from "@/emergency/trackingController";
import { useLocalProfile } from "@/hooks/useLocalProfile";

const DEFAULT_EMERGENCY_NUMBER = "112";

function createController(profile: ReturnType<typeof useLocalProfile>): EmergencyTrackingController {
  const sensorService = new EmergencySensorService(new BrowserEmergencySensorAdapter());
  const configuredEmergencyNumber =
    (import.meta.env.VITE_EMERGENCY_NUMBER as string | undefined)?.trim() || DEFAULT_EMERGENCY_NUMBER;
  const communication = new (class extends BrowserCommunicationAdapter {
    public override async requestEmergencyCall(): Promise<EmergencyCallCapability> {
      if (typeof window === "undefined") return "UNAVAILABLE";
      window.location.assign(`tel:${configuredEmergencyNumber}`);
      return "REQUIRES_USER";
    }
  })();

  return new EmergencyTrackingController(sensorService, () => profile, communication);
}

const INITIAL_SNAPSHOT: TrackingSnapshot = {
  mode: null,
  state: "IDLE",
  trackingActive: false,
  confirmationDeadlineAt: null,
  latestSignal: null,
  lastEscalation: null,
  error: null,
};

export function useEmergencyTracking() {
  const profile = useLocalProfile();
  const controller = useMemo(() => createController(profile), [profile]);
  const [snapshot, setSnapshot] = useState<TrackingSnapshot>(INITIAL_SNAPSHOT);

  useEffect(() => controller.subscribe(setSnapshot), [controller]);

  useEffect(() => {
    return () => {
      void controller.stop();
    };
  }, [controller]);

  return {
    snapshot,
    start: (mode: TrackingMode) => controller.start(mode),
    stop: () => controller.stop(),
    userIsOk: () => controller.userIsOk(),
    userIsNotOk: () => controller.userIsNotOk(),
    manualEmergency: () => controller.manualEmergency(),
    requestEmergencyCall: () => controller.requestEmergencyCall(),
  };
}
