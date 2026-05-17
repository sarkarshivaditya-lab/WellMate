import { useState, useEffect, useRef } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConnectivity } from "@/hooks/useConnectivity";

const RECONNECT_SHOW_MS = 2800;

/**
 * Slim, persistent banner that surfaces connectivity state.
 *
 * Offline:       "Offline — your data is safe and will sync when you reconnect."
 * Reconnected:   "Back online" — disappears after ~3 s
 * Online (steady): renders nothing
 *
 * Never shows during the initial render if the device is already online —
 * it only appears in response to real connectivity transitions.
 */
export default function OfflineBanner() {
  const connectivity = useConnectivity();
  const [showReconnected, setShowReconnected] = useState(false);
  const prevRef = useRef(connectivity);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = connectivity;

    if (prev === "offline" && connectivity === "online") {
      setShowReconnected(true);
      const t = setTimeout(() => setShowReconnected(false), RECONNECT_SHOW_MS);
      return () => clearTimeout(t);
    }
  }, [connectivity]);

  const isOffline = connectivity === "offline";
  const visible = isOffline || showReconnected;

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium border-b",
        isOffline
          ? "bg-muted/50 text-muted-foreground border-border/30"
          : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
      )}
    >
      {isOffline ? (
        <>
          <WifiOff className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <span>Offline — your data is safe and will sync when you reconnect.</span>
        </>
      ) : (
        <>
          <Wifi className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <span>Back online</span>
        </>
      )}
    </div>
  );
}
