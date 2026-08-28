import { AlertTriangle, CheckCircle2, MapPin, ShieldAlert, PhoneCall } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useEmergencyTracking } from "@/hooks/useEmergencyTracking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function stateLabel(state: ReturnType<typeof useEmergencyTracking>["snapshot"]["state"]): string {
  switch (state) {
    case "TRACKING": return "TRACKING ACTIVE";
    case "MOTION_DETECTED": return "MOVEMENT DETECTED";
    case "SUSPICIOUS_MOTION": return "ANALYSING MOVEMENT";
    case "POSSIBLE_ACCIDENT": return "POSSIBLE ACCIDENT";
    case "CONFIRMATION_WINDOW": return "ARE YOU OK?";
    case "ESCALATING": return "ESCALATING EMERGENCY";
    case "ESCALATED": return "EMERGENCY ESCALATED";
    case "UNAVAILABLE": return "SENSORS UNAVAILABLE";
    case "FAILED": return "TRACKING FAILED";
    case "CANCELLED": return "TRACKING CANCELLED";
    default: return "READY FOR GOLDEN HOUR MONITORING";
  }
}

export function EmergencyTrackingPanel() {
  const { snapshot, start, stop, userIsOk, userIsNotOk, manualEmergency, requestEmergencyCall } = useEmergencyTracking();
  const [countdown, setCountdown] = useState<number | null>(null);
  const [callMessage, setCallMessage] = useState<string | null>(null);
  const [manualEscalationDeadline, setManualEscalationDeadline] = useState<number | null>(null);
  const manualTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!snapshot.confirmationDeadlineAt) {
      setCountdown(null);
      return;
    }
    const update = () => setCountdown(Math.max(0, snapshot.confirmationDeadlineAt! - Date.now()));
    update();
    const timer = setInterval(update, 100);
    return () => clearInterval(timer);
  }, [snapshot.confirmationDeadlineAt]);

  useEffect(() => {
    if (manualEscalationDeadline === null) return;
    const update = () => {
      const remaining = Math.max(0, manualEscalationDeadline - Date.now());
      setCountdown(remaining);
      if (remaining <= 0) {
        if (manualTimerRef.current !== null) {
          window.clearInterval(manualTimerRef.current);
          manualTimerRef.current = null;
        }
        setManualEscalationDeadline(null);
        setCountdown(null);
        void manualEmergency();
      }
    };
    update();
    manualTimerRef.current = window.setInterval(update, 100);
    return () => {
      if (manualTimerRef.current !== null) {
        window.clearInterval(manualTimerRef.current);
        manualTimerRef.current = null;
      }
    };
  }, [manualEscalationDeadline]);

  useEffect(() => () => {
    if (manualTimerRef.current !== null) window.clearInterval(manualTimerRef.current);
  }, []);

  const seconds = countdown === null ? null : Math.ceil(countdown / 1000);
  const coordinates = snapshot.latestSignal?.position;

  const cancelManualEmergency = () => {
    if (manualTimerRef.current !== null) {
      window.clearInterval(manualTimerRef.current);
      manualTimerRef.current = null;
    }
    setManualEscalationDeadline(null);
    setCountdown(null);
  };

  const callEmergencyServices = async () => {
    const result = await requestEmergencyCall();
    if (result === "REQUIRES_USER") setCallMessage("Your device opened the emergency call flow; confirm the call on the system dialer.");
    else if (result === "UNAVAILABLE") setCallMessage("Emergency calling is not configured for this build. Use the SOS alert or configured emergency contacts.");
    else setCallMessage("Emergency calling is supported by this build.");
  };

  return (
    <div className="space-y-4">
      <Card className="glass-primary border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-primary/10 p-2.5 text-primary"><ShieldAlert className="h-5 w-5" /></div>
            <div className="min-w-0"><CardTitle className="text-base">Golden Hour emergency monitoring</CardTitle><p className="mt-1 text-sm text-muted-foreground">Bridging the gap between accident and action.</p></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="glass-subtle rounded-2xl"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Current status</p><p className="mt-1 text-xl font-semibold text-foreground">{stateLabel(snapshot.state)}</p>{snapshot.mode && <p className="mt-1 text-xs text-muted-foreground">Mode: {snapshot.mode === "AUTOMATIC" ? "Automatic" : "Manual"}</p>}</div>
          {coordinates && <div className="glass-subtle flex items-start gap-3 rounded-2xl"><MapPin className="mt-0.5 h-4 w-4 text-primary" /><div><p className="text-xs font-medium text-foreground">Location available</p><p className="text-[11px] text-muted-foreground">{coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}</p></div></div>}
          {snapshot.error && <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/[0.04] px-4 py-3"><AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" /><p className="text-xs leading-relaxed text-destructive">{snapshot.error}</p></div>}

          {snapshot.state === "CONFIRMATION_WINDOW" ? (
            <div className="space-y-4 rounded-3xl border-2 border-destructive/40 bg-destructive/[0.06] p-5"><div className="text-center"><p className="text-xs font-bold uppercase tracking-[0.16em] text-destructive">Possible accident detected</p><p className="mt-2 text-3xl font-black text-foreground">{seconds}s</p><p className="mt-1 text-sm text-muted-foreground">Tell WellMate you are okay before the timer expires.</p></div><button type="button" onClick={() => void userIsOk()} className="min-h-16 w-full rounded-2xl bg-emerald-600 px-5 text-lg font-extrabold text-white shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-600/30">I'M OK</button><button type="button" onClick={() => void userIsNotOk()} className="min-h-14 w-full rounded-2xl border-2 border-destructive bg-background px-5 text-base font-bold text-destructive focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-destructive/20">I NEED HELP NOW</button></div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => void start("AUTOMATIC")} className="min-h-14 rounded-2xl bg-primary px-4 text-sm font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25">Start automatic tracking</button><button type="button" onClick={() => void start("MANUAL")} className="min-h-14 rounded-2xl border border-primary/30 bg-background px-4 text-sm font-bold text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">Start manual tracking</button></div>
          )}

          {snapshot.trackingActive && snapshot.state !== "CONFIRMATION_WINDOW" && <button type="button" onClick={() => void stop()} className="min-h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm font-semibold text-muted-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15">Stop tracking</button>}

          {!snapshot.trackingActive && snapshot.state !== "ESCALATED" && snapshot.state !== "CONFIRMATION_WINDOW" && manualEscalationDeadline === null && (
            <button type="button" onClick={() => setManualEscalationDeadline(Date.now() + 10_000)} className="min-h-14 w-full rounded-2xl border-2 border-destructive/40 bg-destructive/[0.04] px-4 text-sm font-extrabold text-destructive focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-destructive/20"><span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4" />SOS — SEND EMERGENCY ALERT</span></button>
          )}

          {manualEscalationDeadline !== null && !snapshot.lastEscalation && (
            <div className="space-y-3 rounded-3xl border-2 border-destructive/40 bg-destructive/[0.06] p-5" role="alert" aria-live="assertive"><div className="text-center"><p className="text-xs font-bold uppercase tracking-[0.16em] text-destructive">Emergency request pending</p><p className="mt-2 text-5xl font-black tabular-nums text-foreground">{seconds ?? 10}</p><p className="mt-1 text-sm text-muted-foreground">The Golden Hour protocol will activate automatically when the countdown ends.</p></div><button type="button" onClick={cancelManualEmergency} className="min-h-14 w-full rounded-2xl border-2 border-destructive bg-background px-5 text-base font-bold text-destructive focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-destructive/20">Cancel request</button></div>
          )}

          {(snapshot.state === "ESCALATED" || snapshot.lastEscalation) && <button type="button" onClick={() => void callEmergencyServices()} className="min-h-14 w-full rounded-2xl border-2 border-amber-500/40 bg-amber-500/[0.06] px-4 text-sm font-extrabold text-amber-700 dark:text-amber-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-500/20"><span className="inline-flex items-center gap-2"><PhoneCall className="h-4 w-4" />Call emergency services</span></button>}
          {callMessage && <p className="text-xs leading-relaxed text-muted-foreground">{callMessage}</p>}
          {snapshot.state === "ESCALATED" && <div className="glass-subtle rounded-2xl px-4 py-4 text-center"><CheckCircle2 className="mx-auto h-5 w-5 text-primary" /><p className="mt-2 text-sm font-semibold text-foreground">Emergency workflow triggered</p><p className="mt-1 text-xs text-muted-foreground">Delivery is shown explicitly below. WellMate never assumes an emergency message was received when the platform cannot confirm delivery.</p></div>}
          {snapshot.lastEscalation && <div className="glass-subtle space-y-2 rounded-2xl px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Notification status</p><p className="text-sm font-semibold text-foreground">{snapshot.lastEscalation.status}</p>{snapshot.lastEscalation.deliveries.map((delivery) => <div key={delivery.contactId} className="flex items-center justify-between gap-3 text-xs"><span className="text-muted-foreground">Contact {delivery.contactId}</span><span className="font-semibold text-foreground">{delivery.status}</span></div>)}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
