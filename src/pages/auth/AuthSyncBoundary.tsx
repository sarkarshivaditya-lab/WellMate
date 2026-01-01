import { useEffect, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useConvex, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { runOfflineSync } from "@/sync/syncScheduler";

/**
 * AuthSyncBoundary
 *
 * - Observes auth readiness
 * - Best-effort identity bootstrap
 * - Triggers offline → Convex sync exactly once
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
      // 1️⃣ Identity bootstrap — best effort only
      try {
        await updateCurrentUser();
      } catch {
        // swallow — identity may already exist or backend not ready
      }

      // 2️⃣ Offline → Convex sync (must still run)
      try {
        await runOfflineSync(convex);
      } catch {
        // swallow — sync must never destabilize app
      }
    })();
  }, [isLoading, isAuthenticated, convex, updateCurrentUser]);

  return null;
}
