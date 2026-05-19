import React from "react";
import {
  readOnboardingPayload,
  OnboardingPayload,
} from "@/data/local/onboardingPayload";
import {
  saveProfilePatch,
  subscribeToProfileUpdates,
} from "@/data/local/profileEditor";
import {
  readHealthExtras,
  saveHealthExtras,
  HealthExtras,
} from "@/data/local/healthExtras";
import { appendWeightEntry } from "@/data/local/weightHistory";

export function useEditableProfile() {
  const [profile, setProfile] = React.useState<OnboardingPayload | null>(
    () => readOnboardingPayload(),
  );
  const [extras, setExtras] = React.useState<HealthExtras>(
    () => readHealthExtras(),
  );

  React.useEffect(() => {
    return subscribeToProfileUpdates(() => {
      setProfile(readOnboardingPayload());
      setExtras(readHealthExtras());
    });
  }, []);

  const updateProfile = React.useCallback(
    (patch: Partial<Omit<OnboardingPayload, "createdAt">>) => {
      if (typeof patch.weightKg === "number") {
        appendWeightEntry(patch.weightKg);
      }
      saveProfilePatch(patch);
    },
    [],
  );

  const updateExtras = React.useCallback(
    (patch: Partial<HealthExtras>) => {
      saveHealthExtras(patch);
    },
    [],
  );

  return { profile, extras, updateProfile, updateExtras };
}
