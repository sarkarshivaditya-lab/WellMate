import { useNavigate } from "react-router-dom";
import { CloudOff } from "lucide-react";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { useConnectivity } from "@/hooks/useConnectivity";

/**
 * Subtle strip that appears only when local operations failed to sync
 * to the server and are in the dead-letter queue.
 *
 * Intentionally calm — the user's data is safe locally.
 * This is a low-priority background concern, not an emergency.
 *
 * Hidden when offline (OfflineBanner covers that situation).
 * Taps through to Profile where sync status is explained.
 */
export default function SyncPulse() {
  const { summary } = useSyncStatus();
  const connectivity = useConnectivity();
  const navigate = useNavigate();

  if (connectivity === "offline" || summary.deadletterCount === 0) return null;

  return (
    <button
      type="button"
      aria-label="Some changes are waiting to upload. Tap to view details."
      onClick={() => navigate("/profile")}
      className="flex items-center justify-center gap-2 w-full px-4 py-2 text-xs font-medium text-amber-700/75 dark:text-amber-400/75 bg-amber-500/[0.05] border-b border-amber-500/10 hover:bg-amber-500/[0.09] transition-colors duration-200"
    >
      <CloudOff className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
      <span>A few changes are waiting to upload.</span>
    </button>
  );
}
