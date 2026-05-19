// Dynamic wellness system prompt builder.
// Assembles a personalized, longitudinally-grounded system prompt for inference.
// Safe to call from non-React contexts (no hooks, no async, pure sync).
//
// Constraints enforced here:
//   - WellMate must NEVER diagnose, prescribe, or replace professional care
//   - All claims must be grounded in the user's actual tracked data
//   - Tone: calm, warm, honest — not clinical, not hype

import { getLongitudinalSummary, serializeSummaryForPrompt } from "../memory/longitudinalSummary";
import { readOnboardingPayload } from "@/data/local/onboardingPayload";

const CORE_IDENTITY =
  "You are WellMate's wellness support layer — a calm, grounded, non-clinical " +
  "companion for personal health reflection. You have access to this user's " +
  "longitudinal wellness history tracked on their device.";

const BEHAVIORAL_CONSTRAINTS =
  "You must never: diagnose medical conditions, prescribe or recommend medications " +
  "or supplements, impersonate a therapist or doctor, make absolute predictions " +
  "about health outcomes, or express more certainty than the data supports. " +
  "When professional care is appropriate, say so clearly and warmly.";

const TONE_GUIDANCE =
  "Speak warmly but factually. Prefer observations over instructions. " +
  "If you lack sufficient data to answer well, say so honestly. " +
  "Keep responses concise — wellness reflections are better when brief.";

export function buildWellnessSystemPrompt(): string {
  const parts: string[] = [CORE_IDENTITY, BEHAVIORAL_CONSTRAINTS, TONE_GUIDANCE];

  // Inject user profile context if available
  const profile = readOnboardingPayload();
  if (profile) {
    const profileParts: string[] = [];

    if (profile.heightCm && profile.weightKg) {
      const bmi = profile.weightKg / ((profile.heightCm / 100) ** 2);
      profileParts.push(
        `height ${profile.heightCm}cm, weight ${profile.weightKg}kg (BMI ${bmi.toFixed(1)})`,
      );
    }

    if (profile.activityLevel) {
      profileParts.push(`activity level: ${profile.activityLevel}`);
    }

    const goal =
      profile.weightGoal === "lose" ||
      profile.weightGoal === "maintain" ||
      profile.weightGoal === "gain"
        ? profile.weightGoal
        : null;

    if (goal) {
      const goalMap: Record<string, string> = {
        lose: "lose weight",
        maintain: "maintain weight",
        gain: "gain weight",
      };
      profileParts.push(`goal: ${goalMap[goal]}`);
    }

    if (profileParts.length > 0) {
      parts.push(`User profile: ${profileParts.join(", ")}.`);
    }
  }

  // Inject weekly longitudinal summary if available
  const summary = getLongitudinalSummary();
  if (summary) {
    parts.push(serializeSummaryForPrompt(summary));
  }

  return parts.join("\n\n");
}
