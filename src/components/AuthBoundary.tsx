import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  readOnboardingPayload,
  clearOnboardingPayload,
} from "@/data/local/onboardingPayload";

/**
 * AuthBoundary
 *
 * Headless auth-aware sync boundary.
 *
 * Responsibilities:
 * - Wait for Convex query to resolve
 * - Promote locally captured onboarding payload into Convex exactly once
 * - Never block UI
 * - Never throw
 * - Idempotent across reloads
 *
 * Renders nothing.
 */
export default function AuthBoundary() {
  const user = useQuery(api.users.getCurrentUser);
  const completeOnboarding = useMutation(api.users.completeOnboarding);

  // Guard against double-apply during re-renders
  const appliedRef = useRef(false);

  useEffect(() => {
    // 1️⃣ Still loading Convex auth/query
    if (user === undefined) return;

    // 2️⃣ Convex user not created yet → wait for bootstrap
    if (user === null) return;

    // 3️⃣ Already completed on server → clean up local payload
    if (user.hasCompletedOnboarding) {
      clearOnboardingPayload();
      return;
    }

    // 4️⃣ Prevent duplicate application in same session
    if (appliedRef.current) return;

    const payload = readOnboardingPayload();
    if (!payload) return;

    appliedRef.current = true;

    (async () => {
      try {
        await completeOnboarding({
          dob: payload.dob,
          sex: payload.sex,
          heightCm: payload.heightCm,
          weightKg: payload.weightKg,
          activityLevel: payload.activityLevel ?? undefined,
          goal: payload.weightGoal,

          cycleLength: payload.cycleLength,
          lastPeriod: payload.lastPeriod,
          additionalHealthNotes: payload.additionalHealthNotes,
        });

        clearOnboardingPayload();
      } catch (err) {
        // Silent failure — will retry on next auth-ready render
        console.error("Deferred onboarding sync failed:", err);
        appliedRef.current = false;
      }
    })();
  }, [user, completeOnboarding]);

  return null;
}
