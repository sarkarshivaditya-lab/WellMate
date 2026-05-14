import { useEffect, useRef } from "react";
import { Authenticated, useConvex, useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { runOfflineSync } from "@/sync/syncScheduler";

/**
 * SyncWorker — only mounts when Convex confirms auth.
 *
 * Three-layer auth safety:
 *
 * 1. <Authenticated> (outer component) — structurally prevents this component
 *    from mounting until useConvexAuth().isAuthenticated is true. Convex's own
 *    implementation: returns null until the backend confirms the token.
 *
 * 2. cancelledRef — set to true in the startup useEffect cleanup (runs on
 *    unmount). Any async sync closure that outlives the component reads this
 *    before every worker call and stops immediately. Prevents the orphaned-
 *    async problem where auth drops while sync is mid-flight.
 *
 * 3. checkAuth passed to runOfflineSync — tested before each sync worker so
 *    auth loss mid-sync stops further mutations without waiting for React.
 */
function SyncWorker() {
  const convex = useConvex();
  const { isAuthenticated } = useConvexAuth();
  const updateCurrentUser = useMutation(api.users.updateCurrentUser);

  // Render-time assignment keeps this current across re-renders. Inside
  // <Authenticated> this is always true while mounted, but it participates
  // in checkAuth() so orphaned closures get the correct value post-unmount.
  const isAuthRef = useRef(false);
  isAuthRef.current = isAuthenticated;

  // Set to true in the startup effect cleanup — signals orphaned async work
  // to abort. Separate from hasRunRef: cancelled=true means "tear down",
  // hasRun=true means "already ran, don't run again".
  const cancelledRef = useRef(false);
  const hasRunRef = useRef(false);

  // Reassigned on every render so online handler always closes over fresh
  // refs without needing them as deps (the ref object itself is stable).
  const runSyncOnce = useRef<() => void>(() => {});
  runSyncOnce.current = () => {
    if (cancelledRef.current) return;
    if (!navigator.onLine) return;
    if (!isAuthRef.current) return;
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    // checkAuth is a live predicate: returns false the moment the component
    // unmounts (cancelledRef) or auth drops (isAuthRef). Passed to the
    // orchestrator so it can abort between workers without relying on React.
    const checkAuth = () => isAuthRef.current && !cancelledRef.current;

    (async () => {
      // 1. Identity bootstrap — best effort only
      try {
        await updateCurrentUser();
      } catch {
        // swallow — identity may already exist
      }

      // 2. Offline → Convex sync
      try {
        await runOfflineSync(convex, checkAuth);
      } catch {
        // swallow — sync must never destabilize app
      }
    })();
  };

  // Startup trigger — fires on mount, which requires <Authenticated> to have
  // rendered this component, guaranteeing Convex auth is confirmed.
  useEffect(() => {
    cancelledRef.current = false;
    runSyncOnce.current();

    return () => {
      // Signal all in-flight async work to stop. Any pending mutation loops
      // will see checkAuth() = false and return before their next mutation.
      cancelledRef.current = true;
    };
  }, []);

  // Online-resume trigger. hasRunRef prevents re-running if startup ran.
  useEffect(() => {
    const handleOnline = () => runSyncOnce.current();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return null;
}

/**
 * AuthSyncBoundary
 *
 * Renders SyncWorker exclusively inside <Authenticated>. Convex's
 * <Authenticated> returns null until useConvexAuth().isAuthenticated is true
 * (backend-confirmed, not Auth0 optimistic state). SyncWorker cannot mount,
 * register effects, or fire mutations until that guarantee holds.
 *
 * HARD GUARANTEES:
 * - NEVER redirects
 * - NEVER blocks rendering
 * - NEVER throws
 * - Safe offline
 * - Safe unauthenticated
 */
export default function AuthSyncBoundary() {
  return (
    <Authenticated>
      <SyncWorker />
    </Authenticated>
  );
}
