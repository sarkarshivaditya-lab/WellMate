/**
 * AuthBoundary — INACTIVE
 *
 * Previously responsible for promoting the local onboarding snapshot
 * into Convex once auth was ready.
 *
 * Onboarding profile promotion has been removed. The onboarding_profile
 * localStorage key is now the permanent device-resident source of truth.
 * All health calculations read from useLocalProfile() instead of Convex.
 *
 * This component is not currently mounted anywhere. It is kept as a
 * placeholder for future optional cloud sync if that feature is added.
 */
export default function AuthBoundary() {
  return null;
}
