import { useEffect, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useMutation, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { runOfflineSync } from "@/sync/syncScheduler";

/**
 * AuthSyncBoundary
 *
 * - Attaches auth identity to Convex
 * - Opportunistically syncs offline data
 * - NEVER blocks rendering
 * - NEVER redirects
 * - NEVER throws
 */
export default function AuthSyncBoundary() {
  const { isAuthenticated, isLoading, user } = useAuth0();
  const updateCurrentUser = useMutation(api.users.updateCurrentUser);
  const convex = useConvex();

  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) return;
    if (hasSyncedRef.current) return;

    hasSyncedRef.current = true;

    updateCurrentUser()
      .then(() => {
        return runOfflineSync(convex);
      })
      .catch(() => {
        // swallowed intentionally
      });
  }, [isLoading, isAuthenticated, user, updateCurrentUser, convex]);

  return null;
}
