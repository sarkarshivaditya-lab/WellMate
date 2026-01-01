import { useEffect, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useConvex } from "convex/react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { runOfflineSync } from "@/sync/syncScheduler";

/**
 * AuthSyncBoundary
 *
 * - Observes auth + network readiness
 * - Attaches Convex identity
 * - Opportunistically syncs offline data
 *
 * HARD GUARANTEES:
 * - NEVER redirects
 * - NEVER blocks rendering
 * - NEVER throws
 * - Safe offline
 * - Safe unauthenticated
 */
export default function AuthSyncBoundary() {
  const { isAuthenticated, isLoading } = useAuth0();
  const convex = useConvex();
  const updateCurrentUser = useMutation(api.users.updateCurrentUser);

  const hasRunRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) return;
    if (!navigator.onLine) return;
    if (hasRunRef.current) return;

    hasRunRef.current = true;

    (async () => {
      try {
        // 1️⃣ Ensure user exists in Convex
        await updateCurrentUser();

        // 2️⃣ Run offline → Convex sync (currently inert by design)
        await runOfflineSync(convex);
      } catch {
        // 🔕 swallow absolutely everything
        // Sync must never destabilize the app
      }
    })();
  }, [isLoading, isAuthenticated, convex, updateCurrentUser]);

  return null;
}
