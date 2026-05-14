import { useEffect, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useConvex, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { runOfflineSync } from "@/sync/syncScheduler";

/**
 * AuthSyncBoundary
 *
 * - Observes auth readiness
 * - Proves token readiness before Convex mutations
 * - Best-effort identity bootstrap (account record creation only)
 * - Triggers offline → Convex sync once auth is ready and online
 * - Resumes sync on reconnect if app started offline
 *
 * Onboarding profile data is intentionally NOT promoted to Convex here.
 * onboarding_profile is the permanent device-resident source of truth.
 *
 * HARD GUARANTEES:
 * - NEVER redirects
 * - NEVER blocks rendering
 * - NEVER throws
 * - Safe offline
 * - Safe unauthenticated
 */
export default function AuthSyncBoundary() {
  const { isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const convex = useConvex();

  const updateCurrentUser = useMutation(api.users.updateCurrentUser);

  const hasRunRef = useRef(false);

  // runSyncOnce.current is reassigned every render so both the startup effect
  // and the online event handler always close over the latest auth and convex
  // state without stale values, while the ref object itself remains stable.
  const runSyncOnce = useRef<() => void>(() => {});
  runSyncOnce.current = () => {
    if (isLoading || !isAuthenticated || !navigator.onLine) return;
    if (hasRunRef.current) return;

    // Lock immediately — prevents re-entry from concurrent triggers
    hasRunRef.current = true;

    (async () => {
      // 0️⃣ Prove Auth0 → Convex token readiness
      try {
        await getAccessTokenSilently();
      } catch {
        // Token not ready yet — abort silently, retry next session
        return;
      }

      // 1️⃣ Identity bootstrap — best effort only
      try {
        await updateCurrentUser();
      } catch {
        // swallow — identity may already exist or backend not ready
      }

      // 2️⃣ Offline → Convex sync (fire-and-forget)
      try {
        await runOfflineSync(convex);
      } catch {
        // swallow — sync must never destabilize app
      }
    })();
  };

  // Startup trigger: fires when auth state settles
  useEffect(() => {
    runSyncOnce.current();
  }, [isLoading, isAuthenticated]);

  // Online-resume trigger: fires when connectivity is restored
  // hasRunRef prevents re-running if startup sync already completed
  useEffect(() => {
    const handleOnline = () => runSyncOnce.current();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return null;
}
