// Launch readiness — centralized capability availability flags.
//
// These flags control which AI features display launch-state notices to users.
// Each flag is a single-line change to enable at launch.
//
// To enable mental coaching at launch:
//   Set mentalCoachingAvailable: true
//   Prerequisite: cloud AI API (Claude/OpenAI) active + aiMentalCoach Convex action configured

export const LAUNCH_STATE = {
  // Advanced mental wellbeing coaching via cloud intelligence infrastructure.
  // When false: informational notices are shown in CoachTabContent and WellMateLauncher.
  // When true: notices are removed; full coaching functionality is available.
  mentalCoachingAvailable: false,
} as const;

export type LaunchState = typeof LAUNCH_STATE;
