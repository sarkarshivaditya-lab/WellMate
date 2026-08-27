import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, MapPin, Phone, Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocalProfile } from "@/hooks/useLocalProfile";
import {
  analyzeMotion,
  beginConfirmation,
  beginTracking,
  confirmationRemainingMs,
  shouldTimeoutConfirmation,
  type EmergencyState,
  type MotionSample,
  type TrackingMode,
} from "@/emergency/detection";
import {
  buildEmergencyEvent,
  getPowerShortcutStatus,
  readCurrentLocation,
  type DeliveryStatus,
} from "@/emergency/emergencyService";
import { cn } from "@/lib/utils";

type TrackingStatus = "READY" | "TRACKING ACTIVE";
type EscalationStatus = "IDLE" | "PENDING" | "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED";

function GoldenHourSurface() {
  const profile = useLocalProfile();
  const trackingMode: TrackingMode = profile?.trackingMode === "manual" ? "manual" : "automatic";
  const [tracking, setTracking] = useState<TrackingStatus>(
    profile ? "READY" : "READY",
  );
  const [state, setState] = useState<EmergencyState>("idle");
  const [countdown, setCountdown] = useState(0);
  const [locationReady, setLocationReady] = useState(false);
  const [delivery, setDelivery] = useState<EscalationStatus>("IDLE");
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const motionSamplesRef = useRef<MotionSample[]>([]);
  const trackingTimerRef = useRef<number | null>(null);
  const contextRef = useRef(beginConfirmation(0));
  const locationRef = useRef<Awaited<ReturnType<typeof readCurrentLocation>>>(null);

  const readiness = useMemo(() => {
    if (!profile) return 0;
    return [
      profile.bloodType,
      profile.emergencyContactName,
      profile.emergencyContactPhone,
      profile.trackingMode,
    ].filter(Boolean).length;
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    void readCurrentLocation().then((location) => {
      if (!cancelled) {
        locationRef.current = location;
        setLocationReady(Boolean(location));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state !== "confirmation" || !contextRef.current.confirmationStartedAtMs) return;
    const startedAt = contextRef.current.confirmationStartedAtMs;
    const timer = window.setInterval(() => {
      const remaining = confirmationRemainingMs(startedAt, Date.now());
      setCountdown(Math.ceil(remaining / 1000));
      if (shouldTimeoutConfirmation(startedAt, Date.now())) {
        window.clearInterval(timer);
        setState("escalating");
        void escalate("timeout");
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(() => {
    if (trackingMode !== "automatic" || state !== "tracking") {
      if (trackingTimerRef.current !== null) {
        window.clearInterval(trackingTimerRef.current);
        trackingTimerRef.current = null;
      }
      return;
    }

    let motionAvailable = false;
    const sampleLocation = async () => {
      const location = await readCurrentLocation();
      locationRef.current = location;
      setLocationReady(Boolean(location));
      const sample: MotionSample = {
        timestampMs: Date.now(),
        locationAccuracyM: location?.accuracy,
        speedMps: undefined,
      };
      motionSamplesRef.current = [...motionSamplesRef.current.slice(-15), sample];
    };

    const onMotion = (event: DeviceMotionEvent) => {
      motionAvailable = true;
      const acceleration = event.accelerationIncludingGravity;
      const rotation = event.rotationRate;
      const accelerationG =
        acceleration
          ? Math.sqrt(
              (acceleration.x ?? 0) ** 2 +
                (acceleration.y ?? 0) ** 2 +
                (acceleration.z ?? 0) ** 2,
            ) / 9.80665
          : undefined;
      const rotationMagnitude = rotation
        ? Math.sqrt(
            (rotation.alpha ?? 0) ** 2 +
              (rotation.beta ?? 0) ** 2 +
              (rotation.gamma ?? 0) ** 2,
          ) / 50
        : undefined;
      const sample: MotionSample = {
        timestampMs: Date.now(),
        speedMps: motionSamplesRef.current.at(-1)?.speedMps,
        accelerationG,
        rotationMagnitude,
        locationAccuracyM: locationRef.current?.accuracy,
      };
      motionSamplesRef.current = [...motionSamplesRef.current.slice(-15), sample];
      handleSample(sample);
    };

    const startMotion = async () => {
      const DeviceMotion = DeviceMotionEvent as typeof DeviceMotionEvent & {
        requestPermission?: () => Promise<"granted" | "denied">;
      };
      if (typeof DeviceMotion.requestPermission === "function") {
        try {
          const permission = await DeviceMotion.requestPermission();
          if (permission !== "granted") return;
        } catch {
          return;
        }
      }
      window.addEventListener("devicemotion", onMotion);
      motionAvailable = true;
    };

    void sampleLocation();
    void startMotion();
    trackingTimerRef.current = window.setInterval(() => void sampleLocation(), 20_000);

    return () => {
      window.removeEventListener("devicemotion", onMotion);
      if (trackingTimerRef.current !== null) {
        window.clearInterval(trackingTimerRef.current);
        trackingTimerRef.current = null;
      }
    };
  }, [trackingMode, state]);

  async function startTracking() {
    if (trackingMode !== "manual") return;
    setTracking("TRACKING ACTIVE");
    setState("tracking");
    setDelivery("IDLE");
    contextRef.current = { ...beginConfirmation(Date.now()), state: "tracking" };
  }

  function handleSample(sample: MotionSample) {
    if (state !== "tracking") return;
    const context = contextRef.current;
    context.nowMs = sample.timestampMs;
    context.recent.push(sample);
    const decision = analyzeMotion(context);
    if (decision.type === "abrupt_stop") {
      contextRef.current = {
        ...context,
        state: "confirmation",
        confirmationStartedAtMs: sample.timestampMs,
      };
      setState("confirmation");
      setCountdown(15);
    } else if (decision.type === "suspicious_motion") {
      setState("suspicious_motion");
    }
  }

  async function escalate(reason: "explicit" | "timeout") {
    if (!beginEscalation()) return;
    setDelivery("PENDING");
    const event = buildEmergencyEvent(
      {
        bloodType: profile?.bloodType ?? "",
        allergies: profile?.allergies ?? "",
        emergencyContactName: profile?.emergencyContactName ?? "",
        emergencyContactPhone: profile?.emergencyContactPhone ?? "",
        trackingMode,
      },
      "ESCALATING",
      locationRef.current ?? undefined,
    );
    setLastEvent(JSON.stringify({ reason, eventState: event.state }));
    // No autonomous SMS/call is claimed here. A real dispatcher must report delivery.
    // Until then, surface PENDING rather than fabricate a success state.
    setState("escalated");
    setTracking("READY");
    setDelivery(getDeliveryStatus(false));
    completeEscalation();
  }

  function cancelConfirmation() {
    contextRef.current = { ...beginConfirmation(Date.now()), state: "tracking" };
    setState("cancelled");
    setCountdown(0);
    window.setTimeout(() => setState("tracking"), 0);
  }

  if (!profile) {
    return (
      <Card className="glass-brand border-primary/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-4 w-4" aria-hidden />
            Golden Hour
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Complete your emergency profile in onboarding to enable Golden Hour readiness.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-primary overflow-hidden border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-primary">
              Golden Hour
            </p>
            <CardTitle className="mt-1 text-xl">Every second between impact and action matters.</CardTitle>
          </div>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
            {trackingMode === "automatic" ? "AUTO" : "MANUAL"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="glass-subtle rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tracking</p>
            <p className="mt-1 text-sm font-semibold">{tracking}</p>
          </div>
          <div className="glass-subtle rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Profile</p>
            <p className="mt-1 text-sm font-semibold">{readiness}/4 ready</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className={cn("h-3.5 w-3.5", locationReady && "text-primary")} aria-hidden />
          {getLocationReadinessMessage(locationRef.current ?? undefined)}
          <span className="ml-auto">
            Power shortcut: {getPowerShortcutStatus()}
          </span>
        </div>

        {trackingMode === "manual" && tracking !== "TRACKING ACTIVE" && state !== "confirmation" && (
          <Button onClick={startTracking} className="w-full min-h-12">
            <Radio className="h-4 w-4" aria-hidden />
            Start tracking
          </Button>
        )}

        {trackingMode === "automatic" && state === "idle" && (
          <div className="glass-subtle rounded-xl p-3 text-xs text-muted-foreground">
            Automatic mode is ready to combine low-frequency location context with higher-frequency motion signals when meaningful movement is detected.
          </div>
        )}

        {state === "suspicious_motion" && (
          <div className="glass-subtle rounded-xl p-3 text-xs text-amber-700 border-amber-300/40">
            Unusual motion detected. Waiting for corroborating movement signals.
          </div>
        )}

        {state === "confirmation" && (
          <div className="rounded-2xl border-2 border-destructive/30 bg-background p-4 space-y-4" role="alert" aria-live="assertive">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-destructive">Possible accident detected</p>
                <p className="text-xs text-muted-foreground">You have {countdown} seconds to respond.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="min-h-14"
                onClick={cancelConfirmation}
              >
                <CheckCircle2 className="h-5 w-5" aria-hidden />
                I&apos;M OK
              </Button>
              <Button
                variant="destructive"
                className="min-h-14"
                onClick={() => void escalate("explicit")}
              >
                <Phone className="h-5 w-5" aria-hidden />
                I NEED HELP NOW
              </Button>
            </div>
          </div>
        )}

        {state === "escalated" && (
          <div className="rounded-2xl border border-border bg-background p-4 space-y-2">
            <p className="text-sm font-semibold">Emergency event prepared</p>
            <p className="text-xs text-muted-foreground">
              Delivery: <span className="font-semibold">{delivery}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              WellMate does not claim autonomous calling or SMS without platform delivery confirmation.
            </p>
          </div>
        )}

        {lastEvent && (
          <p className="sr-only">Emergency event recorded.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default GoldenHourSurface;
