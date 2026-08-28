import React from "react";
import { readOnboardingPayload } from "@/data/local/onboardingPayload";
import type { OnboardingPayload } from "@/data/local/onboardingPayload";
import {
  saveProfilePatch,
  subscribeToProfileUpdates,
} from "@/data/local/profileEditor";
import {
  readHealthExtras,
  saveHealthExtras,
} from "@/data/local/healthExtras";
import type { HealthExtras } from "@/data/local/healthExtras";
import { appendWeightEntry } from "@/data/local/weightHistory";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

type RemoteUser = {
  dob?: string;
  sex?: "male" | "female" | "other";
  heightCm?: number;
  weightKg?: number;
  activityLevel?:
    | "sedentary"
    | "light"
    | "moderate"
    | "active"
    | "veryActive";
  goal?: "lose" | "maintain" | "gain";
  dietaryPreference?: string;
  allergies?: string[];
  periodTrackingEnabled?: boolean;
  dailySteps?: string;
  weightGoal?: string;
  muscleGoal?: string;
  cycleLength?: number;
  lastPeriod?: string;
  additionalHealthNotes?: string;
  bloodType?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  localAmbulanceNumber?: string;
  trackingMode?: "automatic" | "manual";
};

function remoteToLocal(
  remote: RemoteUser,
  local: OnboardingPayload | null,
): OnboardingPayload {
  return {
    dob: remote.dob ?? local?.dob ?? "",
    sex: remote.sex ?? local?.sex ?? "",
    heightCm: remote.heightCm ?? local?.heightCm ?? 0,
    weightKg: remote.weightKg ?? local?.weightKg ?? 0,
    activityLevel: remote.activityLevel ?? local?.activityLevel ?? null,
    dailySteps: remote.dailySteps ?? local?.dailySteps ?? "",
    weightGoal:
      remote.weightGoal ??
      remote.goal ??
      local?.weightGoal ??
      "",
    muscleGoal: remote.muscleGoal ?? local?.muscleGoal ?? "",
    cycleLength: remote.cycleLength ?? local?.cycleLength,
    lastPeriod: remote.lastPeriod ?? local?.lastPeriod,
    additionalHealthNotes:
      remote.additionalHealthNotes ??
      local?.additionalHealthNotes,
    bloodType: remote.bloodType ?? local?.bloodType ?? "",
    allergies:
      remote.allergies?.join(", ") ??
      local?.allergies ??
      "",
    emergencyContactName:
      remote.emergencyContactName ??
      local?.emergencyContactName ??
      "",
    emergencyContactPhone:
      remote.emergencyContactPhone ??
      local?.emergencyContactPhone ??
      "",
    localAmbulanceNumber:
      remote.localAmbulanceNumber ??
      local?.localAmbulanceNumber ??
      "",
    trackingMode:
      remote.trackingMode ??
      local?.trackingMode ??
      "automatic",
    createdAt: local?.createdAt ?? Date.now(),
  };
}

export function useEditableProfile() {
  const [profile, setProfile] =
    React.useState<OnboardingPayload | null>(
      () => readOnboardingPayload(),
    );

  const [extras, setExtras] =
    React.useState<HealthExtras>(
      () => readHealthExtras(),
    );

  const remoteUser = useQuery(api.users.getCurrentUser);
  const updateUserProfile =
    useMutation(api.users.updateUserProfile);

  React.useEffect(() => {
    return subscribeToProfileUpdates(() => {
      setProfile(readOnboardingPayload());
      setExtras(readHealthExtras());
    });
  }, []);

  React.useEffect(() => {
    if (remoteUser === undefined || remoteUser === null) {
      return;
    }

    const local = readOnboardingPayload();
    const merged = remoteToLocal(
      remoteUser as RemoteUser,
      local,
    );

    try {
      localStorage.setItem(
        "onboarding_profile",
        JSON.stringify(merged),
      );
    } catch {
      // Local cache is best effort.
    }

    setProfile(merged);
  }, [remoteUser]);

  const updateProfile = React.useCallback(
    (
      patch: Partial<
        Omit<OnboardingPayload, "createdAt">
      >,
    ) => {
      if (typeof patch.weightKg === "number") {
        appendWeightEntry(patch.weightKg);
      }

      saveProfilePatch(patch);

      void updateUserProfile({
        dob: patch.dob,
        sex:
          patch.sex === "male" ||
          patch.sex === "female" ||
          patch.sex === "other"
            ? patch.sex
            : undefined,
        heightCm: patch.heightCm,
        weightKg: patch.weightKg,
        activityLevel:
          patch.activityLevel === "sedentary" ||
          patch.activityLevel === "light" ||
          patch.activityLevel === "moderate" ||
          patch.activityLevel === "active" ||
          patch.activityLevel === "veryActive"
            ? patch.activityLevel
            : undefined,
        goal:
          patch.weightGoal === "lose" ||
          patch.weightGoal === "maintain" ||
          patch.weightGoal === "gain"
            ? patch.weightGoal
            : undefined,
        allergies: patch.allergies
          ? patch.allergies
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean)
          : undefined,
        periodTrackingEnabled:
          patch.cycleLength !== undefined ||
          patch.lastPeriod !== undefined
            ? true
            : undefined,
        dailySteps: patch.dailySteps,
        weightGoal: patch.weightGoal,
        muscleGoal: patch.muscleGoal,
        cycleLength: patch.cycleLength,
        lastPeriod: patch.lastPeriod,
        additionalHealthNotes:
          patch.additionalHealthNotes,
        bloodType: patch.bloodType,
        emergencyContactName:
          patch.emergencyContactName,
        emergencyContactPhone:
          patch.emergencyContactPhone,
        localAmbulanceNumber:
          patch.localAmbulanceNumber,
        trackingMode: patch.trackingMode,
      }).catch((error) => {
        console.error(
          "[WellMate] Failed to sync profile update:",
          error,
        );
      });
    },
    [updateUserProfile],
  );

  const updateExtras = React.useCallback(
    (patch: Partial<HealthExtras>) => {
      saveHealthExtras(patch);
    },
    [],
  );

  return {
    profile,
    extras,
    updateProfile,
    updateExtras,
  };
}
