import { useEffect, useMemo, useState } from "react";
import { BrowserEmergencySensorAdapter, EmergencySensorService } from "@/emergency/sensorService";
import { BrowserCommunicationAdapter } from "@/emergency/platformCommunication";
import { EmergencyTrackingController, type TrackingMode, type TrackingSnapshot } from "@/emergency/trackingController";
import { useLocalProfile } from "@/hooks/useLocalProfile";

function createController(profile: ReturnType<typeof useLocalProfile>): EmergencyTrackingController {
  const sensorService = new EmergencySensorService(new BrowserEmergencySensorAdapter());
  const communication = new BrowserCommunicationAdapter();
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
  };
}
