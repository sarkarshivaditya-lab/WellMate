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
 * - Best-effort identity bootstrap
 * - Promotes local onboarding → Convex
 * - Triggers offline → Convex sync exactly once per session
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
  const completeOnboarding = useMutation(api.users.completeOnboarding);

  const hasRunRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) return;
    if (!navigator.onLine) return;
    if (hasRunRef.current) return;

    // Lock immediately to guarantee exactly-once semantics per session
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

      // 1.5️⃣ Promote onboarding snapshot (if present)
      try {
        const raw = localStorage.getItem("onboarding_profile");
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, unknown>;

          // Defensive, schema-safe mapping (only pass known fields)
          const payload: Record<string, unknown> = {};
          if (typeof parsed.dob === "string") payload.dob = parsed.dob;
          if (
            parsed.sex === "male" ||
            parsed.sex === "female" ||
            parsed.sex === "other"
          )
            payload.sex = parsed.sex;
          if (typeof parsed.heightCm === "number")
            payload.heightCm = parsed.heightCm;
          if (typeof parsed.weightKg === "number")
            payload.weightKg = parsed.weightKg;
          if (
            parsed.activityLevel === "sedentary" ||
            parsed.activityLevel === "light" ||
            parsed.activityLevel === "moderate" ||
            parsed.activityLevel === "active" ||
            parsed.activityLevel === "veryActive"
          )
            payload.activityLevel = parsed.activityLevel;
          if (
            parsed.goal === "lose" ||
            parsed.goal === "maintain" ||
            parsed.goal === "gain"
          )
            payload.goal = parsed.goal;
          if (typeof parsed.dietaryPreference === "string")
            payload.dietaryPreference = parsed.dietaryPreference;
          if (Array.isArray(parsed.allergies))
            payload.allergies = parsed.allergies;
          if (typeof parsed.periodTrackingEnabled === "boolean")
            payload.periodTrackingEnabled = parsed.periodTrackingEnabled;

          // Best-effort; server is idempotent
          await completeOnboarding(payload);

          // Remove only after successful mutation
          localStorage.removeItem("onboarding_profile");
        }
      } catch {
        // swallow — onboarding promotion must never destabilize app
      }

      // 2️⃣ Offline → Convex sync (fire-and-forget)
      try {
        await runOfflineSync(convex);
      } catch {
        // swallow — sync must never destabilize app
      }
    })();
  }, [
    isLoading,
    isAuthenticated,
    getAccessTokenSilently,
    convex,
    updateCurrentUser,
    completeOnboarding,
  ]);

  return null;
}
