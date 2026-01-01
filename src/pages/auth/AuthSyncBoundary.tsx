import { useEffect, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * AuthSyncBoundary
 *
 * Observes authentication state and opportunistically
 * syncs identity + local data when available.
 *
 * - NEVER redirects
 * - NEVER blocks rendering
 * - NEVER throws
 * - Safe in offline / unauthenticated mode
 */
export default function AuthSyncBoundary() {
  const { isAuthenticated, isLoading, user } = useAuth0();
  const updateCurrentUser = useMutation(api.users.updateCurrentUser);

  // Prevent duplicate syncs per session
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) return;
    if (hasSyncedRef.current) return;

    hasSyncedRef.current = true;

    // Fire-and-forget identity attachment
    updateCurrentUser().catch(() => {
      // Intentionally swallowed
      // Sync must never crash the app
    });
  }, [isLoading, isAuthenticated, user, updateCurrentUser]);

  return null;
}
